import { createSignal, createEffect, createMemo, For, Show } from 'solid-js';
import { formatCompactRupiah, parseSmartRupiahNumber } from '../../services/api';
import { t, isEn } from '../../utils/i18n';

const KPR_PROGRAMS = [
  {
    id: 'btn-fix-3',
    labelId: 'KPR Promo Fix 3 Tahun (6.50%)',
    labelEn: 'KPR Promo Fixed 3 Yrs (6.50%)',
    rate: 6.5
  },
  {
    id: 'btn-fix-5',
    labelId: 'KPR Bunga Fix 5 Tahun (7.25%)',
    labelEn: 'KPR Fixed 5 Yrs (7.25%)',
    rate: 7.25
  },
  {
    id: 'std-effective',
    labelId: 'KPR Bunga Efektif (7.50%)',
    labelEn: 'KPR Effective Rate (7.50%)',
    rate: 7.5
  },
  {
    id: 'syariah-margin',
    labelId: 'KPR Syariah Margin (8.00%)',
    labelEn: 'Sharia KPR Margin (8.00%)',
    rate: 8.0
  }
];

export default function KprSimulator(props) {
  const unitsList = createMemo(() => (Array.isArray(props.units) ? props.units : []));

  const resolveInitialPrice = () => {
    const direct = parseSmartRupiahNumber(props.initialPrice);
    if (direct > 0) return direct;
    const firstUnit = unitsList()[0];
    if (firstUnit) {
      const uPrice = parseSmartRupiahNumber(firstUnit.rawPrice || firstUnit.price);
      if (uPrice > 0) return uPrice;
    }
    return 900000000;
  };

  const [selectedUnitId, setSelectedUnitId] = createSignal(
    props.selectedUnitId || unitsList()[0]?.id || ''
  );
  const [priceNum, setPriceNum] = createSignal(resolveInitialPrice());
  const [dpPercent, setDpPercent] = createSignal(props.defaultDpPercent ?? 30);
  const [programId, setProgramId] = createSignal(KPR_PROGRAMS[0].id);
  const [tenorYears, setTenorYears] = createSignal(20);
  const [simulatedResult, setSimulatedResult] = createSignal(null);

  const formatInputRupiahText = (num) => {
    if (!num || num <= 0) return '0';
    const clean = formatCompactRupiah(num).replace(/^Rp\s+/i, '');
    if (isEn()) {
      return clean.replace(/Miliar/gi, 'Billion').replace(/Juta/gi, 'Million');
    }
    return clean;
  };

  const dpAmount = createMemo(() => {
    const pct = Math.min(90, Math.max(0, Number(dpPercent()) || 0));
    return Math.round((priceNum() * pct) / 100);
  });

  const runCalculation = (
    pVal = priceNum(),
    dpPctVal = dpPercent(),
    progIdVal = programId(),
    tenorVal = tenorYears()
  ) => {
    const cleanPrice = Math.max(0, Number(pVal) || 0);
    const cleanDpPct = Math.min(90, Math.max(0, Number(dpPctVal) || 0));
    const cleanTenor = Math.min(35, Math.max(1, Number(tenorVal) || 15));
    const prog = KPR_PROGRAMS.find((item) => item.id === progIdVal) || KPR_PROGRAMS[0];

    const dpNominal = Math.round((cleanPrice * cleanDpPct) / 100);
    const loanPrincipal = Math.max(0, cleanPrice - dpNominal);
    const monthlyRate = prog.rate / 100 / 12;
    const totalMonths = cleanTenor * 12;

    let monthlyPayment = 0;
    if (loanPrincipal > 0 && monthlyRate > 0 && totalMonths > 0) {
      const factor = Math.pow(1 + monthlyRate, totalMonths);
      monthlyPayment = Math.round((loanPrincipal * (monthlyRate * factor)) / (factor - 1));
    } else if (loanPrincipal > 0 && totalMonths > 0) {
      monthlyPayment = Math.round(loanPrincipal / totalMonths);
    }

    setSimulatedResult({
      price: cleanPrice,
      dpPercent: cleanDpPct,
      dpNominal,
      loanPrincipal,
      rate: prog.rate,
      tenorYears: cleanTenor,
      monthlyPayment
    });
  };

  // Sinkronisasi ulang harga & perhitungan otomatis setiap kali unit atau properti berganti
  createEffect(() => {
    const units = unitsList();
    const targetPrice = resolveInitialPrice();
    const defaultDp = props.defaultDpPercent ?? 30;

    if (!parseSmartRupiahNumber(props.initialPrice) && units.length > 0) {
      setSelectedUnitId(units[0].id || units[0].name);
    }

    if (targetPrice > 0) {
      setPriceNum(targetPrice);
      setDpPercent(defaultDp);
      runCalculation(targetPrice, defaultDp, programId(), tenorYears());
    }
  });

  const handleUnitSelectChange = (e) => {
    const val = e.currentTarget.value;
    setSelectedUnitId(val);
    const found = unitsList().find((u) => String(u.id) === String(val) || u.name === val);
    if (found) {
      const uPrice = parseSmartRupiahNumber(found.rawPrice || found.price);
      if (uPrice > 0) {
        setPriceNum(uPrice);
        runCalculation(uPrice, dpPercent(), programId(), tenorYears());
      }
    }
  };

  const handlePriceInputChange = (e) => {
    const parsed = parseSmartRupiahNumber(e.currentTarget.value);
    if (parsed > 0) {
      setPriceNum(parsed);
    }
  };

  return (
    <div class="kpr-card-outer">
      <div class="kpr-card-header">
        <div class="kpr-bank-badge">
          <span>KPR</span>
        </div>
        <div class="kpr-header-text">
          <span class="kpr-header-eyebrow">{t('kprTitle')}</span>
          <strong class="kpr-header-title">
            {props.unitName || props.projectName || 'JakUrban Finance'}
          </strong>
        </div>
      </div>

      <div class="kpr-card-body">
        <div class="kpr-form-inner">
          {/* Dropdown pilih unit bila di halaman PropertyDetail */}
          <Show when={unitsList().length > 1 && !props.isUnitLocked}>
            <div class="kpr-field-stack">
              <label class="kpr-label">{t('kprSelectUnitLabel')}</label>
              <select
                class="kpr-select"
                value={selectedUnitId()}
                onChange={handleUnitSelectChange}
              >
                <For each={unitsList()}>
                  {(u) => (
                    <option value={u.id || u.name}>
                      {u.name} ({u.price})
                    </option>
                  )}
                </For>
              </select>
            </div>
          </Show>

          {/* Harga Properti */}
          <div class="kpr-row-inline">
            <label class="kpr-label">
              {t('kprPropertyPrice')} <span class="kpr-required-star">*</span>
            </label>
            <div class="kpr-input-addon-box">
              <span class="kpr-prefix">Rp</span>
              <input
                type="text"
                class="kpr-input-right"
                value={formatInputRupiahText(priceNum())}
                onChange={handlePriceInputChange}
              />
            </div>
          </div>

          {/* Uang Muka (DP Default 30%) */}
          <div class="kpr-field-stack">
            <label class="kpr-label">{t('kprDownPayment')}</label>
            <div class="kpr-dp-combined-box">
              <input
                type="number"
                min="10"
                max="90"
                class="kpr-dp-pct-input"
                value={dpPercent()}
                onInput={(e) => setDpPercent(Number(e.currentTarget.value) || 0)}
              />
              <span class="kpr-dp-divider">%</span>
              <span class="kpr-dp-divider">Rp</span>
              <input
                type="text"
                class="kpr-dp-nominal-display"
                value={formatInputRupiahText(dpAmount())}
                readOnly
              />
            </div>
          </div>

          {/* Pilihan Program KPR */}
          <div class="kpr-field-stack">
            <label class="kpr-label">{t('kprProgramLabel')}</label>
            <select
              class="kpr-select"
              value={programId()}
              onChange={(e) => setProgramId(e.currentTarget.value)}
            >
              <For each={KPR_PROGRAMS}>
                {(prog) => (
                  <option value={prog.id}>
                    {isEn() ? prog.labelEn : prog.labelId}
                  </option>
                )}
              </For>
            </select>
          </div>

          {/* Jangka Waktu (Tenor) */}
          <div class="kpr-row-inline">
            <label class="kpr-label">{t('kprTenorLabel')}</label>
            <div class="kpr-tenor-box">
              <input
                type="number"
                min="1"
                max="30"
                class="kpr-tenor-input"
                value={tenorYears()}
                onInput={(e) => setTenorYears(Number(e.currentTarget.value) || 15)}
              />
              <span class="kpr-tenor-suffix">{t('kprYears')}</span>
            </div>
          </div>

          <button
            type="button"
            class="kpr-btn-simulate"
            onClick={() => runCalculation(priceNum(), dpPercent(), programId(), tenorYears())}
          >
            {t('kprSimulateBtn')}
          </button>

          {/* Hasil Simulasi Ringkas */}
          <Show when={simulatedResult()}>
            {(res) => (
              <div class="kpr-result-panel">
                <div class="kpr-result-main">
                  <span>{t('kprMonthlyInstallment')}</span>
                  <strong>
                    Rp {formatInputRupiahText(res().monthlyPayment)}
                    <small>/{isEn() ? 'mo' : 'bln'}</small>
                  </strong>
                </div>
                <div class="kpr-result-row">
                  <span>DP ({res().dpPercent}%):</span>
                  <strong>Rp {formatInputRupiahText(res().dpNominal)}</strong>
                </div>
                <div class="kpr-result-row">
                  <span>{isEn() ? 'Loan (70%):' : 'Plafon KPR:'}</span>
                  <strong>Rp {formatInputRupiahText(res().loanPrincipal)}</strong>
                </div>
              </div>
            )}
          </Show>
        </div>

        <div class="kpr-disclaimer">
          <strong>{t('kprDisclaimerBold')}</strong> : {t('kprDisclaimerText')}
        </div>
      </div>
    </div>
  );
}