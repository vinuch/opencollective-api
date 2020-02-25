import { GraphQLString, GraphQLObjectType, GraphQLInt, GraphQLNonNull, GraphQLList } from 'graphql';
import models, { Op } from '../../../models';

import { setContextPermission, PERMISSION_TYPE } from '../../common/context-permissions';
import { canViewExpensePrivateInfo, getExpenseAttachments } from '../../common/expenses';
import { CommentCollection } from '../collection/CommentCollection';
import { Account } from '../interface/Account';
import { CollectionArgs } from '../interface/Collection';
import { getIdEncodeResolver, IDENTIFIER_TYPES } from '../identifiers';

import { ChronologicalOrder } from '../input/ChronologicalOrder';
import PayoutMethod from './PayoutMethod';
import { ExpenseType } from '../enum/ExpenseType';
import { Currency } from '../enum';
import ExpenseAttachment from './ExpenseAttachment';

const Expense = new GraphQLObjectType({
  name: 'Expense',
  description: 'This represents an Expense',
  fields: () => {
    return {
      id: {
        type: new GraphQLNonNull(GraphQLString),
        resolve: getIdEncodeResolver(IDENTIFIER_TYPES.EXPENSE),
      },
      legacyId: {
        type: new GraphQLNonNull(GraphQLInt),
        description: 'Legacy ID as returned by API V1. Avoid relying on this field as it may be removed in the future.',
        resolve(expense) {
          return expense.id;
        },
      },
      description: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Title of the expense',
      },
      currency: {
        type: new GraphQLNonNull(Currency),
        description: 'Title of the expense',
      },
      type: {
        type: new GraphQLNonNull(ExpenseType),
        description: 'Title of the expense',
      },
      comments: {
        type: new GraphQLNonNull(CommentCollection),
        args: {
          ...CollectionArgs,
          orderBy: {
            type: ChronologicalOrder,
            defaultValue: ChronologicalOrder.defaultValue,
          },
        },
        async resolve(expense, { limit, offset, orderBy }) {
          const { count, rows } = await models.Comment.findAndCountAll({
            where: {
              ExpenseId: { [Op.eq]: expense.id },
            },
            order: [[orderBy.field, orderBy.direction]],
            offset,
            limit,
          });
          return {
            offset,
            limit,
            totalCount: count,
            nodes: rows,
          };
        },
      },
      payee: {
        type: new GraphQLNonNull(Account),
        description: 'The account being paid by this expense',
        async resolve(expense, _, req) {
          // Set the permissions for account's fields
          const canSeePrivateInfo = (await canViewExpensePrivateInfo(expense, req)).userLocation;
          setContextPermission(req, PERMISSION_TYPE.SEE_ACCOUNT_LOCATION, expense.FromCollectiveId, canSeePrivateInfo);

          // Return fromCollective
          return req.loaders.Collective.byId.load(expense.FromCollectiveId);
        },
      },
      createdByAccount: {
        type: Account,
        description: 'The account who created this expense',
        async resolve(expense, _, req) {
          return req.loaders.Collective.byId.load(expense.FromCollectiveId);
        },
      },
      payoutMethod: {
        type: PayoutMethod,
        description: 'The payout method to use for this expense',
        async resolve(expense, _, req) {
          if (expense.PayoutMethodId) {
            const expensePermissions = await canViewExpensePrivateInfo(expense, req);
            if (expensePermissions.payoutMethod) {
              setContextPermission(req, PERMISSION_TYPE.SEE_PAYOUT_METHOD_DATA, expense.PayoutMethodId, true);
            }
            return req.loaders.PayoutMethod.byId.load(expense.PayoutMethodId);
          }
        },
      },
      attachments: {
        type: new GraphQLList(ExpenseAttachment),
        async resolve(expense, _, req) {
          const expensePermissions = await canViewExpensePrivateInfo(expense, req);
          if (expensePermissions.attachments) {
            setContextPermission(req, PERMISSION_TYPE.SEE_EXPENSE_ATTACHMENTS_URL, expense.id, true);
          }

          return getExpenseAttachments(expense.id, req);
        },
      },
      invoiceInfo: {
        type: GraphQLString,
        description: 'Information to display on the invoice. Only visible to user and admins.',
        async resolve(expense, _, req) {
          const expensePermissions = await canViewExpensePrivateInfo(expense, req);
          if (expensePermissions.invoiceInfo) {
            return expense.invoiceInfo;
          }
        },
      },
    };
  },
});

export { Expense };
