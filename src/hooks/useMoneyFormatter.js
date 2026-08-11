import { useCallback, useMemo } from 'react';
import { useAccountCurrency } from './useAccountCurrency';
import { formatMoney, formatMoneyOrZero, formatMoneyCompact, getCurrencySymbol } from '../utils/formatMoney';

/** Admin money formatting bound to logged-in account currency. */
export function useMoneyFormatter(currencyOverride) {
  const accountCurrency = useAccountCurrency(currencyOverride);
  const currency = currencyOverride ?? accountCurrency;

  const format = useCallback((amount) => formatMoney(amount, currency), [currency]);
  const formatOrZero = useCallback((amount) => formatMoneyOrZero(amount, currency), [currency]);
  const formatCompact = useCallback((amount) => formatMoneyCompact(amount, currency), [currency]);
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  return {
    currency,
    formatMoney: format,
    formatMoneyOrZero: formatOrZero,
    formatMoneyCompact: formatCompact,
    currencySymbol,
  };
}
