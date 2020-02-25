import { GraphQLString, GraphQLObjectType, GraphQLNonNull, GraphQLBoolean } from 'graphql';
import GraphQLJSON from 'graphql-type-json';
import { getIdEncodeResolver, IDENTIFIER_TYPES } from '../identifiers';
import PayoutMethodType from '../enum/PayoutMethodType';
import { getContextPermission, PERMISSION_TYPE } from '../../common/context-permissions';

const PayoutMethod = new GraphQLObjectType({
  name: 'PayoutMethod',
  description: 'A payout method',
  fields: {
    id: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: getIdEncodeResolver(IDENTIFIER_TYPES.PAYOUT_METHOD),
    },
    type: {
      type: PayoutMethodType,
    },
    name: {
      type: GraphQLString,
      resolve: (payoutMethod, _, req): string => {
        if (getContextPermission(req, PERMISSION_TYPE.SEE_PAYOUT_METHOD_DATA, payoutMethod.id)) {
          return payoutMethod.name;
        }
      },
    },
    isSaved: {
      type: GraphQLBoolean,
      resolve: (payoutMethod, _, req): boolean => {
        if (getContextPermission(req, PERMISSION_TYPE.SEE_PAYOUT_METHOD_DATA, payoutMethod.id)) {
          return payoutMethod.isSaved;
        }
      },
    },
    data: {
      type: GraphQLJSON,
      resolve: (payoutMethod, _, req): object => {
        if (getContextPermission(req, PERMISSION_TYPE.SEE_PAYOUT_METHOD_DATA, payoutMethod.id)) {
          return payoutMethod.data;
        }
      },
    },
  },
});

export default PayoutMethod;
