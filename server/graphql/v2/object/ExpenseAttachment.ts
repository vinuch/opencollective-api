import { GraphQLString, GraphQLInt, GraphQLNonNull, GraphQLObjectType } from 'graphql';
import { GraphQLDateTime } from 'graphql-iso-date';
import { getContextPermission, PERMISSION_TYPE } from '../../common/context-permissions';

const ExpenseAttachment = new GraphQLObjectType({
  name: 'ExpenseAttachment',
  description: 'Fields for an expense attachment',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    amount: { type: new GraphQLNonNull(GraphQLInt) },
    createdAt: { type: new GraphQLNonNull(GraphQLDateTime) },
    updatedAt: { type: new GraphQLNonNull(GraphQLDateTime) },
    incurredAt: { type: new GraphQLNonNull(GraphQLDateTime) },
    description: { type: GraphQLString },
    url: {
      type: GraphQLString,
      resolve(attachment, _, req): string | undefined {
        if (getContextPermission(req, PERMISSION_TYPE.SEE_EXPENSE_ATTACHMENTS_URL, attachment.ExpenseId)) {
          return attachment.url;
        }
      },
    },
  },
});

export default ExpenseAttachment;
