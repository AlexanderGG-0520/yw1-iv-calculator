import { useMemo, useRef, useState } from "react";
import { ArrowDownUp, Search } from "lucide-react";
import type { WorkerResponse } from "./workers/reverseSearch.worker";
import { STAT_KEYS, type B2Mode, type PersonalityMode, type ReverseResult, type ScorePreset, type SearchInput, type SearchResponse, type StatBlock, type StatKey } from "./engine/types";
import { YOKAI } from "./engine/yokaiData";
import { provisionalLinearEngine } from "./engine/calculationEngine";

type SortKey = "score" | StatKey;
type SortDirection = "asc" | "desc";

const defaultObserved: StatBlock = {
  hp: 80,
  strength: 60,
  spirit: 45,
  defense: 45,
  speed: 58,
};

const statLabel: Record<StatKey, string> = {
  hp: "HP",
  strength: "Strength",
  spirit: "Spirit",
  defense: "Defense",
  speed: "Speed",
};

function App() {
  const workerRef = useRef<Worker | null>(null);
  const [speciesId, setSpeciesId] = useState(YOKAI[0].id);
  const [level, setLevel] = useState(20);
  const [observed, setObserved] = useState<StatBlock>(defaultObserved);
  const [personalityMode, setPersonalityMode] = useState<PersonalityMode>("none");
  const [b2Mode, setB2Mode] = useState<B2Mode>("direct");
  const [scorePreset, setScorePreset] = useState<ScorePreset>("physical_attacker");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedResults = useMemo(() => {
    const results = [...(response?.results ?? [])];
    const direction = sortDirection === "asc" ? 1 : -1;
    return results.sort((left, right) => {
      const leftValue = sortKey === "score" ? left.score : left.ivA[sortKey] + left.ivB1[sortKey] + left.ivB2[sortKey];
      const rightValue = sortKey === "score" ? right.score : right.ivA[sortKey] + right.ivB1[sortKey] + right.ivB2[sortKey];
      return (leftValue - rightValue) * direction;
    });
  }, [response, sortDirection, sortKey]);

  function updateObserved(stat: StatKey, value: number) {
    setObserved((current) => ({ ...current, [stat]: value }));
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

    workerRef.current?.terminate();
    const worker = new Worker(new URL("./workers/reverseSearch.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    const payload: SearchInput = {
      speciesId,
      level,
      observed,
      personalityMode,
      b2Mode,
      scorePreset,
      maxResults: 100,
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

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Yo-kai Watch 1 IV Reverse Calculator</h1>
            <p>{provisionalLinearEngine.formulaStatus}</p>
          </div>
          <button type="button" onClick={runSearch} disabled={isSearching}>
            <Search size={18} aria-hidden="true" />
            {isSearching ? "Searching" : "Reverse"}
          </button>
        </header>

        <section className="controls" aria-label="Search controls">
          <label>
            Yo-kai
            <select value={speciesId} onChange={(event) => setSpeciesId(event.target.value)}>
              {YOKAI.map((species) => (
                <option key={species.id} value={species.id}>
                  {species.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Level
            <input min={1} max={99} type="number" value={level} onChange={(event) => setLevel(Number(event.target.value))} />
          </label>

          <label>
            Personality bonus
            <select value={personalityMode} onChange={(event) => setPersonalityMode(event.target.value as PersonalityMode)}>
              <option value="none">None</option>
              <option value="physical_attacker">Physical attacker</option>
              <option value="magic_attacker">Magic attacker</option>
              <option value="wall">Wall</option>
              <option value="speed">Speed</option>
            </select>
          </label>

          <label>
            B_2 mode
            <select value={b2Mode} onChange={(event) => setB2Mode(event.target.value as B2Mode)}>
              <option value="direct">Direct</option>
              <option value="evolved_once">Evolved once</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <label>
            Score preset
            <select value={scorePreset} onChange={(event) => setScorePreset(event.target.value as ScorePreset)}>
              <option value="physical_attacker">Physical attacker</option>
              <option value="magic_attacker">Magic attacker</option>
              <option value="wall">Wall</option>
            </select>
          </label>
        </section>

        <section className="stat-grid" aria-label="Observed stats">
          {STAT_KEYS.map((stat) => (
            <label key={stat}>
              {statLabel[stat]}
              <input min={0} type="number" value={observed[stat]} onChange={(event) => updateObserved(stat, Number(event.target.value))} />
            </label>
          ))}
        </section>

        {error ? <p className="error">{error}</p> : null}

        {response ? (
          <section className="summary" aria-label="Search summary">
            <span>Results: {response.results.length}</span>
            <span>Visited: {response.summary.combinationsVisited.toLocaleString()}</span>
            <span>{response.summary.truncated ? "Search truncated at safety cap" : "Search completed"}</span>
            {STAT_KEYS.map((stat) => (
              <span key={stat}>
                {statLabel[stat]} candidates: {response.summary.perStatCandidateCounts[stat]}
              </span>
            ))}
          </section>
        ) : null}

        <ResultTable results={sortedResults} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
      </section>
    </main>
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
    <section className="table-wrap" aria-label="Reverse search results">
      <table>
        <thead>
          <tr>
            <th>
              <button type="button" onClick={() => onSort("score")} aria-label="Sort by score">
                Score <ArrowDownUp size={14} aria-hidden="true" />
              </button>
            </th>
            {STAT_KEYS.map((stat) => (
              <th key={stat}>
                <button type="button" onClick={() => onSort(stat)} aria-label={`Sort by ${statLabel[stat]}`}>
                  {statLabel[stat]} <ArrowDownUp size={14} aria-hidden="true" />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr>
              <td colSpan={6}>No results yet.</td>
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

export default App;
