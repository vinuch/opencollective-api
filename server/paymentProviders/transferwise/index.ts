import uuidv4 from 'uuid/v4';

import * as transferwise from '../../lib/transferwise';
import cache from '../../lib/cache';
import models from '../../models';
import { Quote } from '../../types/transferwise';

export const blackListedCurrencies = [
  /** Only private customers sending payments to private recipients. Business customers and business recipients are not supported yet. */
  'BRL',
  'BDT',
  'PKR',
  /** Incomplete requiredFields API */
  'UYU',
];

async function populateProfileId(connectedAccount): Promise<void> {
  if (!connectedAccount.data.profile) {
    const profiles = await transferwise.getProfiles(connectedAccount.token);
    const profile =
      profiles.find(p => p.type === connectedAccount.type) || profiles.find(p => p.type === 'business') || profiles[0];
    if (profile) {
      await connectedAccount.update({ data: { ...connectedAccount.data, ...profile } });
    }
  }
}

async function getTemporaryQuote(connectedAccount, payoutMethod, expense): Promise<Quote> {
  return await transferwise.getTemporaryQuote(connectedAccount.token, {
    sourceCurrency: expense.currency,
    targetCurrency: payoutMethod.data.currency,
    targetAmount: expense.amount / 100,
  });
}

async function quoteExpense(connectedAccount, payoutMethod, expense): Promise<Quote> {
  await populateProfileId(connectedAccount);

  // Guarantees the target amount if in the same currency of expense
  const { rate } = await getTemporaryQuote(connectedAccount, payoutMethod, expense);
  const targetAmount = (expense.amount / 100) * rate;

  const quote = await transferwise.createQuote(connectedAccount.token, {
    profileId: connectedAccount.data.id,
    sourceCurrency: expense.currency,
    targetCurrency: payoutMethod.data.currency,
    targetAmount,
  });

  return quote;
}

async function payExpense(connectedAccount, payoutMethod, expense): Promise<any> {
  const quote = await quoteExpense(connectedAccount, payoutMethod, expense);

  const recipient = await transferwise.createRecipientAccount(connectedAccount.token, {
    profileId: connectedAccount.data.id,
    ...payoutMethod.data,
  });

  const transfer = await transferwise.createTransfer(connectedAccount.token, {
    accountId: recipient.id,
    quoteId: quote.id,
    uuid: uuidv4(),
    details: {
      reference: `Expense ${expense.id}`,
    },
  });

  const fund = await transferwise.fundTransfer(connectedAccount.token, {
    profileId: connectedAccount.data.id,
    transferId: transfer.id,
  });
  if (fund.status === 'REJECTED') {
    throw new Error(`Transferwise could not fund transfer: ${fund.errorCode}`);
  }

  return { quote, recipient, transfer, fund };
}

async function getRequiredBankInformation(host: any, currency: string): Promise<any> {
  const cacheKey = `transferwise_required_bank_info_${host.id}_to_${currency}`;
  const fromCache = await cache.get(cacheKey);
  if (fromCache) {
    return fromCache;
  }

  const connectedAccount = await models.ConnectedAccount.findOne({
    where: { service: 'transferwise', CollectiveId: host.id, deletedAt: null },
  });
  if (!connectedAccount) {
    throw new Error('Host is not connected to Transferwise');
  }

  const quote = await transferwise.createQuote(connectedAccount.token, {
    profileId: connectedAccount.data.id,
    sourceCurrency: host.currency,
    targetCurrency: currency,
    targetAmount: 100,
  });
  const requiredFields = await transferwise.getAccountRequirements(connectedAccount.token, quote.id);
  cache.set(cacheKey, requiredFields, 24 * 60 * 60 /* a whole day and we could probably increase */);
  return requiredFields;
}

async function getAvailableCurrencies(host: any): Promise<any> {
  const cacheKey = `transferwise_available_currencies_${host.id}`;
  const fromCache = await cache.get(cacheKey);
  if (fromCache) {
    return fromCache;
  }

  const connectedAccount = await models.ConnectedAccount.findOne({
    where: {
      service: 'transferwise',
      CollectiveId: host.id,
      deletedAt: null,
    },
  });
  if (!connectedAccount) {
    throw new Error('Host is not connected to Transferwise');
  }

  const pairs = await transferwise.getCurrencyPairs(connectedAccount.token);
  const source = pairs.sourceCurrencies.find(sc => sc.currencyCode === host.currency);
  const currencies = source.targetCurrencies
    .filter(c => !blackListedCurrencies.includes(c.currencyCode))
    .map(c => c.currencyCode);
  cache.set(cacheKey, currencies, 24 * 60 * 60 /* a whole day and we could probably increase */);
  return currencies;
}

export default {
  getAvailableCurrencies,
  getRequiredBankInformation,
  getTemporaryQuote,
  quoteExpense,
  payExpense,
};
