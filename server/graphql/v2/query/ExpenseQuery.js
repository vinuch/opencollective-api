import { GraphQLString, GraphQLInt } from 'graphql';

import { Expense } from '../object/Expense';
import { getDecodedId } from '../identifiers';

const ExpenseQuery = {
  type: Expense,
  args: {
    id: {
      type: GraphQLString,
      description: 'Public expense identifier',
    },
    legacyId: {
      type: GraphQLInt,
      description: 'Public expense identifier',
    },
  },
  async resolve(_, args, req) {
    const id = args.legacyId || getDecodedId(args.id);
    if (!id) {
      throw new Error('You must either provide an id or a legacyId');
    }

    return req.loaders.Expense.byId.load(id);
  },
};

export default ExpenseQuery;
