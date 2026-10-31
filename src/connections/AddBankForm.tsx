import { useState } from 'react';
import type { Bank, PsuType } from '../../shared/types';
import { cx } from '../components/cx';
import { COUNTRIES } from '../model/countries';
import { addBank } from '../store';
import styles from './AddBankForm.module.css';
import { useBanks } from './useBanks';

function CountrySelect({ value, onChange }: { value: string; onChange: (country: string) => void }) {
  return (
    <label>
      Country
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {COUNTRIES.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function BankSelect(props: { banks: Bank[] | null; value: string; onChange: (bankName: string) => void }) {
  return (
    <label>
      Bank
      <select
        className="input"
        value={props.value}
        disabled={!props.banks}
        onChange={(event) => props.onChange(event.target.value)}
        required
      >
        <option value="">{props.banks ? 'Choose…' : 'Loading…'}</option>
        {props.banks?.map((bank) => (
          <option key={bank.name} value={bank.name}>
            {bank.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PsuTypeSelect({ value, onChange }: { value: PsuType; onChange: (psuType: PsuType) => void }) {
  return (
    <label>
      Account type
      <select className="input" value={value} onChange={(event) => onChange(event.target.value as PsuType)}>
        <option value="personal">Personal</option>
        <option value="business">Business</option>
      </select>
    </label>
  );
}

export function AddBankForm({ onClose }: { onClose: () => void }) {
  const [country, setCountry] = useState('EE');
  const banks = useBanks(country);
  const [bankName, setBankName] = useState('');
  const [psuType, setPsuType] = useState<PsuType>('personal');
  const [accountName, setAccountName] = useState('');
  const [sending, setSending] = useState(false);
  const bank = banks?.find((candidate) => candidate.name === bankName);

  function changeCountry(newCountry: string) {
    setCountry(newCountry);
    setBankName('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!bank) return;
    setSending(true);
    await addBank({
      bank: bank.name,
      country,
      psuType: bank.psuTypes.includes(psuType) ? psuType : bank.psuTypes[0],
      accountName: accountName.trim() || undefined,
    });
    setSending(false);
  }

  return (
    <form className={cx('card', styles.form)} onSubmit={submit}>
      <h3>Add a bank</h3>
      <div className={styles.fields}>
        <CountrySelect value={country} onChange={changeCountry} />
        <BankSelect banks={banks} value={bankName} onChange={setBankName} />
        {bank && bank.psuTypes.length > 1 && <PsuTypeSelect value={psuType} onChange={setPsuType} />}
        <label>
          Expense tracker account
          <input
            className="input"
            value={accountName}
            placeholder={bank ? bank.name.toLowerCase() : ''}
            onChange={(event) => setAccountName(event.target.value)}
            spellCheck={false}
          />
        </label>
      </div>
      <p className="muted">
        {bank
          ? `You log in at ${bank.name} and come back here; the access lasts ${bank.maximumConsentDays} days.`
          : 'You log in at the bank and come back here.'}
      </p>
      <div className={styles.buttons}>
        <button type="submit" className="btn primary" disabled={!bank || sending}>
          {sending ? 'Opening the bank…' : 'Log in to bank'}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
