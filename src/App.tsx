import { useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ArrowDownUp, Copy, Search } from "lucide-react";
import type { WorkerResponse } from "./workers/reverseSearch.worker";
import { formatCandidateJson, formatCandidateText, formatStatLine } from "./engine/copyFormat";
import { calculateStatBlock } from "./engine/forwardCalculation";
import { BUILT_IN_SCORE_PROFILES, formatScoreWeights, hasAnyScoreWeight, resolveScoreProfile } from "./engine/scoring";
import { STAT_KEYS, type PersonalityMode, type ReverseResult, type ScorePreset, type SearchInput, type SearchResponse, type StatBlock, type StatKey } from "./engine/types";
import { YOKAI } from "./engine/yokaiData";
import { sourceCharacteristicBonus, togenyanPortedEngine } from "./engine/calculationEngine";

type SortKey = "score" | StatKey;
type SortDirection = "asc" | "desc";
type PersonalitySelection = PersonalityMode | "custom";

const emptyStats = (): StatBlock => ({ hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 });

const defaultObserved: StatBlock = { hp: 80, strength: 60, spirit: 45, defense: 45, speed: 58 };
const defaultForwardIvA: StatBlock = { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 };
const defaultForwardB1: StatBlock = { hp: 2, strength: 2, spirit: 2, defense: 2, speed: 2 };
const defaultForwardB2: StatBlock = { hp: 0, strength: 0, spirit: 0, defense: 0, speed: 0 };
const defaultCustomScoreWeights: StatBlock = { hp: 2, strength: 2, spirit: 2, defense: 2, speed: 2 };

const statLabel: Record<StatKey, string> = {
  hp: "HP",
  strength: "ちから",
  spirit: "ようりょく",
  defense: "まもり",
  speed: "すばやさ",
};

const personalityOptions: { value: PersonalityMode; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "short_tempered", label: "短気 (+HP/+ちから)" },
  { value: "physical_attacker", label: "荒くれ (+ちから)" },
  { value: "calm", label: "れいせい (+ようりょく/+すばやさ)" },
  { value: "magic_attacker", label: "ずのう的 (+ようりょく)" },
  { value: "careful", label: "しんちょう (+ようりょく/+まもり)" },
  { value: "wall", label: "動じない (+まもり)" },
  { value: "kind", label: "やさしい (+HP/+ようりょく)" },
  { value: "compassionate", label: "情け深い (+HP)" },
  { value: "nasty", label: "いやらしい (+ちから/+すばやさ)" },
  { value: "speed", label: "非道 (+すばやさ)" },
  { value: "devoted", label: "協力的 (+HP/+すばやさ)" },
];

const formulaStatusLabel = togenyanPortedEngine.formulaStatusKind.replaceAll("_", " ");

function resolvePersonality(selection: PersonalitySelection, customBonus: StatBlock) {
  if (selection === "custom") {
    return { personalityMode: "none" as PersonalityMode, personalityBonus: customBonus };
  }
  return { personalityMode: selection, personalityBonus: undefined };
}

function customTotal(stats: StatBlock): number {
  return STAT_KEYS.reduce((sum, stat) => sum + stats[stat], 0);
}

function App() {
  const workerRef = useRef<Worker | null>(null);
  const [speciesId, setSpeciesId] = useState(YOKAI[0].id);
  const [yokaiFilter, setYokaiFilter] = useState("");
  const [level, setLevel] = useState(20);
  const [observed, setObserved] = useState<StatBlock>(defaultObserved);
  const [personalitySelection, setPersonalitySelection] = useState<PersonalitySelection>("none");
  const [customBonus, setCustomBonus] = useState<StatBlock>(emptyStats);
  const [knownEvolutionCount, setKnownEvolutionCount] = useState(0);
  const [evolutionCountUnknown, setEvolutionCountUnknown] = useState(false);
  const [scorePreset, setScorePreset] = useState<ScorePreset>("physical_attacker");
  const [customScoreWeights, setCustomScoreWeights] = useState<StatBlock>(defaultCustomScoreWeights);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAll, setShowAll] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [forwardSpeciesId, setForwardSpeciesId] = useState(YOKAI[0].id);
  const [forwardLevel, setForwardLevel] = useState(20);
  const [forwardPersonalitySelection, setForwardPersonalitySelection] = useState<PersonalitySelection>("none");
  const [forwardCustomBonus, setForwardCustomBonus] = useState<StatBlock>(emptyStats);
  const [forwardIvA, setForwardIvA] = useState<StatBlock>(defaultForwardIvA);
  const [forwardB1, setForwardB1] = useState<StatBlock>(defaultForwardB1);
  const [forwardB2, setForwardB2] = useState<StatBlock>(defaultForwardB2);

  const selectedSpecies = useMemo(() => YOKAI.find((species) => species.id === speciesId) ?? YOKAI[0], [speciesId]);
  const activeScoreProfile = useMemo(() => resolveScoreProfile(scorePreset, customScoreWeights), [customScoreWeights, scorePreset]);

  const sortedResults = useMemo(() => {
    const results = [...(response?.results ?? [])];
    const direction = sortDirection === "asc" ? 1 : -1;
    return results.sort((left, right) => {
      const leftValue = sortKey === "score" ? left.score : left.ivA[sortKey] + left.ivB1[sortKey] + left.ivB2[sortKey];
      const rightValue = sortKey === "score" ? right.score : right.ivA[sortKey] + right.ivB1[sortKey] + right.ivB2[sortKey];
      return (leftValue - rightValue) * direction;
    });
  }, [response, sortDirection, sortKey]);

  const visibleResults = showAll ? sortedResults : sortedResults.slice(0, 20);

  const filteredYokai = useMemo(() => {
    const query = yokaiFilter.trim().toLowerCase();
    if (!query) {
      return YOKAI;
    }

    const matches = YOKAI.filter((species) =>
      [species.name, species.sourceName, species.sourceFurigana, species.id, species.number?.toString()]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
    const selected = YOKAI.find((species) => species.id === speciesId);
    if (selected && !matches.some((species) => species.id === selected.id)) {
      return [selected, ...matches];
    }
    return matches;
  }, [speciesId, yokaiFilter]);

  const forwardResult = useMemo(() => {
    const personality = resolvePersonality(forwardPersonalitySelection, forwardCustomBonus);
    return calculateStatBlock({
      speciesId: forwardSpeciesId,
      level: forwardLevel,
      ivA: forwardIvA,
      ivB1: forwardB1,
      ivB2: forwardB2,
      ...personality,
    });
  }, [forwardB1, forwardB2, forwardCustomBonus, forwardIvA, forwardLevel, forwardPersonalitySelection, forwardSpeciesId]);

  function updateBlock(setter: Dispatch<SetStateAction<StatBlock>>, stat: StatKey, value: number) {
    setter((current) => ({ ...current, [stat]: value }));
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "score" ? "desc" : "asc");
  }

  function runSearch() {
    setIsSearching(true);
    setError(null);
    setResponse(null);
    setShowAll(false);

    workerRef.current?.terminate();
    const worker = new Worker(new URL("./workers/reverseSearch.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    const personality = resolvePersonality(personalitySelection, customBonus);
    const payload: SearchInput = {
      speciesId,
      level,
      observed,
      evolutionCount: evolutionCountUnknown ? "unknown" : knownEvolutionCount,
      scorePreset,
      customScoreWeights,
      maxResults: 100,
      ...personality,
    };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      setIsSearching(false);
      if (event.data.type === "success") {
        setResponse(event.data.payload);
      } else {
        setError(event.data.error);
      }
      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = (event) => {
      setIsSearching(false);
      setError(event.message);
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ type: "search", payload });
  }

  async function copyCandidate(result: ReverseResult, format: "text" | "json") {
    const personality = resolvePersonality(personalitySelection, customBonus);
    const value =
      format === "text"
        ? formatCandidateText({ species: selectedSpecies, level, result, ...personality })
        : formatCandidateJson({ species: selectedSpecies, level, result, ...personality });
    await navigator.clipboard.writeText(value);
    setCopyStatus(format === "text" ? "テキストをコピーしました" : "JSONをコピーしました");
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>妖怪ウォッチ1 IV逆算</h1>
            <p>
              <span className={`status-badge status-${togenyanPortedEngine.formulaStatusKind}`}>{formulaStatusLabel}</span>
              {togenyanPortedEngine.formulaStatus}
            </p>
          </div>
        </header>

        <section className="panel" aria-label="逆算">
          <div className="section-heading">
            <h2>逆算</h2>
            <button type="button" onClick={runSearch} disabled={isSearching}>
              <Search size={18} aria-hidden="true" />
              {isSearching ? "検索中" : "逆算"}
            </button>
          </div>

          <YokaiControls
            speciesId={speciesId}
            setSpeciesId={setSpeciesId}
            yokaiFilter={yokaiFilter}
            setYokaiFilter={setYokaiFilter}
            filteredYokai={filteredYokai}
          />

          <section className="controls" aria-label="逆算設定">
            <NumberInput label="レベル" value={level} min={1} max={99} onChange={setLevel} />
            <PersonalitySelect value={personalitySelection} onChange={setPersonalitySelection} />
            <NumberInput
              label="進化回数"
              value={knownEvolutionCount}
              min={0}
              disabled={evolutionCountUnknown}
              onChange={(value) => setKnownEvolutionCount(Math.max(0, Math.floor(value)))}
            />
            <label className="inline-check">
              <input
                type="checkbox"
                checked={evolutionCountUnknown}
                onChange={(event) => setEvolutionCountUnknown(event.target.checked)}
              />
              進化回数が不明
            </label>
            <label>
              スコア
              <select value={scorePreset} onChange={(event) => setScorePreset(event.target.value as ScorePreset)}>
                {BUILT_IN_SCORE_PROFILES.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </label>
          </section>

          <section className="score-profile-info" aria-label="評価プロファイル">
            <p>
              <strong>{activeScoreProfile.name}</strong>: {activeScoreProfile.description}
            </p>
            <p>{formatScoreWeights(activeScoreProfile.weights)}</p>
          </section>
          {scorePreset === "custom" ? (
            <CustomScoreFields values={customScoreWeights} onChange={(stat, value) => updateBlock(setCustomScoreWeights, stat, value)} />
          ) : null}
          {scorePreset === "custom" && !hasAnyScoreWeight(customScoreWeights) ? (
            <p className="warning">Customウェイトがすべて0のため、バランス評価でスコアを計算します。</p>
          ) : null}

          {personalitySelection === "custom" ? (
            <CustomBonusFields values={customBonus} onChange={(stat, value) => updateBlock(setCustomBonus, stat, value)} />
          ) : null}
          {personalitySelection === "custom" && customTotal(customBonus) !== 0 && customTotal(customBonus) !== 20 ? (
            <p className="warning">Custom合計が通常値と異なる可能性があります。確認用としてそのまま計算します。</p>
          ) : null}

          <p className="warning">実機ステータスは装備なしで入力してください。性格ボーナスが不明な個体はCustomを使ってください。</p>
          <StatInputs title="実機ステータス" values={observed} onChange={(stat, value) => updateBlock(setObserved, stat, value)} />
        </section>

        {error ? <p className="error">{error}</p> : null}

        {response ? (
          <section className="summary" aria-label="検索サマリー">
            <span>候補: {response.results.length}</span>
            <span>確認数: {response.summary.combinationsVisited.toLocaleString()}</span>
            <span>{response.summary.truncated ? "安全上限で停止" : "検索完了"}</span>
            {STAT_KEYS.map((stat) => (
              <span key={stat}>
                {statLabel[stat]}候補: {response.summary.perStatCandidateCounts[stat]}
              </span>
            ))}
          </section>
        ) : null}

        <section className="panel" aria-label="候補">
          <div className="section-heading">
            <h2>候補</h2>
            <label className="inline-check">
              <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
              全候補を表示
            </label>
          </div>
          {copyStatus ? <p className="copy-status">{copyStatus}</p> : null}
          <ResultCards results={visibleResults} onCopy={copyCandidate} />
          <ResultTable results={visibleResults} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
        </section>

        <ForwardSection
          speciesId={forwardSpeciesId}
          setSpeciesId={setForwardSpeciesId}
          level={forwardLevel}
          setLevel={setForwardLevel}
          personalitySelection={forwardPersonalitySelection}
          setPersonalitySelection={setForwardPersonalitySelection}
          customBonus={forwardCustomBonus}
          setCustomBonus={setForwardCustomBonus}
          ivA={forwardIvA}
          setIvA={setForwardIvA}
          b1={forwardB1}
          setB1={setForwardB1}
          b2={forwardB2}
          setB2={setForwardB2}
          result={forwardResult}
        />
      </section>
    </main>
  );
}

function YokaiControls({
  speciesId,
  setSpeciesId,
  yokaiFilter,
  setYokaiFilter,
  filteredYokai,
}: {
  speciesId: string;
  setSpeciesId: (value: string) => void;
  yokaiFilter: string;
  setYokaiFilter: (value: string) => void;
  filteredYokai: typeof YOKAI;
}) {
  return (
    <section className="controls" aria-label="妖怪選択">
      <label>
        妖怪検索
        <input type="search" value={yokaiFilter} onChange={(event) => setYokaiFilter(event.target.value)} placeholder="名前 / ID / 番号" />
      </label>
      <label className="wide-field">
        妖怪
        <select value={speciesId} onChange={(event) => setSpeciesId(event.target.value)}>
          {filteredYokai.map((species) => (
            <option key={species.id} value={species.id}>
              {species.number ? `${species.number}. ` : ""}
              {species.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function PersonalitySelect({ value, onChange }: { value: PersonalitySelection; onChange: (value: PersonalitySelection) => void }) {
  return (
    <label>
      性格ボーナス
      <select value={value} onChange={(event) => onChange(event.target.value as PersonalitySelection)}>
        {personalityOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        min={min}
        max={max}
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function StatInputs({ title, values, onChange }: { title: string; values: StatBlock; onChange: (stat: StatKey, value: number) => void }) {
  return (
    <section>
      <h3>{title}</h3>
      <div className="stat-grid">
        {STAT_KEYS.map((stat) => (
          <NumberInput key={stat} label={statLabel[stat]} value={values[stat]} min={0} onChange={(value) => onChange(stat, value)} />
        ))}
      </div>
    </section>
  );
}

function CustomBonusFields({ values, onChange }: { values: StatBlock; onChange: (stat: StatKey, value: number) => void }) {
  return <StatInputs title="Custom性格ボーナス" values={values} onChange={onChange} />;
}

function CustomScoreFields({ values, onChange }: { values: StatBlock; onChange: (stat: StatKey, value: number) => void }) {
  return <StatInputs title="Custom評価ウェイト" values={values} onChange={onChange} />;
}

function StatBlockLine({ label, values }: { label: string; values: StatBlock }) {
  return (
    <div className="block-line">
      <strong>{label}</strong>
      <span>{formatStatLine(values)}</span>
    </div>
  );
}

function ResultCards({ results, onCopy }: { results: ReverseResult[]; onCopy: (result: ReverseResult, format: "text" | "json") => void }) {
  if (results.length === 0) {
    return <p className="empty-state">候補はまだありません。</p>;
  }

  return (
    <div className="result-cards">
      {results.map((result) => (
        <article key={result.id} className="result-card">
          <div className="card-head">
            <div>
              <span className="muted">スコア</span>
              <strong>{result.score.toFixed(1)}</strong>
              <span className="muted">使用中の評価: {result.scoreProfile?.name ?? "バランス"}</span>
            </div>
            <div className="copy-actions">
              <button type="button" onClick={() => onCopy(result, "text")}>
                <Copy size={16} aria-hidden="true" />
                text
              </button>
              <button type="button" onClick={() => onCopy(result, "json")}>
                <Copy size={16} aria-hidden="true" />
                JSON
              </button>
            </div>
          </div>
          <StatBlockLine label="IV_A" values={result.ivA} />
          <StatBlockLine label="B_1" values={result.ivB1} />
          <StatBlockLine label="B_2" values={result.ivB2} />
          <StatBlockLine label="計算結果" values={result.calculated} />
        </article>
      ))}
    </div>
  );
}

interface ResultTableProps {
  results: ReverseResult[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}

function ResultTable({ results, sortDirection, sortKey, onSort }: ResultTableProps) {
  return (
    <section className="table-wrap" aria-label="詳細候補">
      <table>
        <thead>
          <tr>
            <th>
              <button type="button" onClick={() => onSort("score")} aria-label="スコアで並び替え">
                スコア <ArrowDownUp size={14} aria-hidden="true" />
              </button>
            </th>
            {STAT_KEYS.map((stat) => (
              <th key={stat}>
                <button type="button" onClick={() => onSort(stat)} aria-label={`${statLabel[stat]}で並び替え`}>
                  {statLabel[stat]} <ArrowDownUp size={14} aria-hidden="true" />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr>
              <td colSpan={6}>候補はまだありません。</td>
            </tr>
          ) : (
            results.map((result) => (
              <tr key={result.id}>
                <td>
                  {result.score.toFixed(1)}
                  {sortKey === "score" ? <span className="sort-mark">{sortDirection}</span> : null}
                </td>
                {STAT_KEYS.map((stat) => (
                  <td key={stat}>
                    <span className="stat-triplet">
                      A {result.ivA[stat]} / B_1 {result.ivB1[stat]} / B_2 {result.ivB2[stat]}
                    </span>
                    {sortKey === stat ? <span className="sort-mark">{sortDirection}</span> : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function ForwardSection({
  speciesId,
  setSpeciesId,
  level,
  setLevel,
  personalitySelection,
  setPersonalitySelection,
  customBonus,
  setCustomBonus,
  ivA,
  setIvA,
  b1,
  setB1,
  b2,
  setB2,
  result,
}: {
  speciesId: string;
  setSpeciesId: (value: string) => void;
  level: number;
  setLevel: (value: number) => void;
  personalitySelection: PersonalitySelection;
  setPersonalitySelection: (value: PersonalitySelection) => void;
  customBonus: StatBlock;
  setCustomBonus: Dispatch<SetStateAction<StatBlock>>;
  ivA: StatBlock;
  setIvA: Dispatch<SetStateAction<StatBlock>>;
  b1: StatBlock;
  setB1: Dispatch<SetStateAction<StatBlock>>;
  b2: StatBlock;
  setB2: Dispatch<SetStateAction<StatBlock>>;
  result: StatBlock;
}) {
  const updateBlock = (setter: Dispatch<SetStateAction<StatBlock>>, stat: StatKey, value: number) => {
    setter((current) => ({ ...current, [stat]: value }));
  };

  return (
    <section className="panel" aria-label="順計算">
      <div className="section-heading">
        <h2>順計算</h2>
      </div>
      <section className="controls">
        <label className="wide-field">
          妖怪
          <select value={speciesId} onChange={(event) => setSpeciesId(event.target.value)}>
            {YOKAI.map((species) => (
              <option key={species.id} value={species.id}>
                {species.number ? `${species.number}. ` : ""}
                {species.name}
              </option>
            ))}
          </select>
        </label>
        <NumberInput label="レベル" value={level} min={1} max={99} onChange={setLevel} />
        <PersonalitySelect value={personalitySelection} onChange={setPersonalitySelection} />
      </section>
      {personalitySelection === "custom" ? (
        <CustomBonusFields values={customBonus} onChange={(stat, value) => updateBlock(setCustomBonus, stat, value)} />
      ) : (
        <StatBlockLine label="性格ボーナス" values={sourceCharacteristicBonus[personalitySelection]} />
      )}
      {personalitySelection === "custom" && customTotal(customBonus) !== 0 && customTotal(customBonus) !== 20 ? (
        <p className="warning">Custom合計が通常値と異なる可能性があります。確認用としてそのまま計算します。</p>
      ) : null}
      <StatInputs title="IV_A" values={ivA} onChange={(stat, value) => updateBlock(setIvA, stat, value)} />
      <StatInputs title="IV_B_1" values={b1} onChange={(stat, value) => updateBlock(setB1, stat, value)} />
      <StatInputs title="IV_B_2" values={b2} onChange={(stat, value) => updateBlock(setB2, stat, value)} />
      <div className="forward-output" aria-label="計算結果">
        <h3>計算結果</h3>
        <div className="result-stats">
          {STAT_KEYS.map((stat) => (
            <div key={stat}>
              <span>{statLabel[stat]}</span>
              <strong>{result[stat]}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default App;
