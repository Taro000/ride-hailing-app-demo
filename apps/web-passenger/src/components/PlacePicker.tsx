import type { PlaceCandidates, PlaceInput, PlaceResolved } from "@ride/contracts";
import { Button, ErrorNotice, TextField, problemMessage } from "@ride/web-shared";
import { useId, useMemo, useState, type FormEvent } from "react";
import { api } from "../api.ts";

export interface PickedPlace extends PlaceInput {
  label: string;
}

// 住所や施設の名前で探して選ぶ（FR-02 AC2）。探す語は本文で送る（DEC-16）。sessionToken で一回の選び方をまとめる（DEC-22）。
// 地図のピンで指定する手段（FR-02 AC2・3・5、IFC-16）と現在地（FR-02 AC1、IFC-18）は縦の一本の外。
export function PlacePicker(props: {
  label: string;
  value: PickedPlace | null;
  onChange: (place: PickedPlace | null) => void;
}) {
  const headingId = useId();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidates["items"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionToken = useMemo(() => crypto.randomUUID(), []);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    const result = await api.call<PlaceCandidates>({
      method: "POST",
      path: "/api/v1/passenger/places/search",
      body: { query: query.trim(), sessionToken },
      kind: "read",
    });
    setBusy(false);
    if (result.ok) setCandidates(result.data.items);
    else setError(result.error.kind === "answered" ? problemMessage(result.error.problem) : "通信できませんでした");
  }

  async function choose(placeId: string) {
    setBusy(true);
    const result = await api.call<PlaceResolved>({
      method: "POST",
      path: "/api/v1/passenger/places/resolve",
      body: { placeId, sessionToken },
      kind: "read",
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.kind === "answered" ? problemMessage(result.error.problem) : "通信できませんでした");
      return;
    }
    setCandidates(null);
    props.onChange({
      position: result.data.position,
      placeId: result.data.placeId,
      label: result.data.name,
      source: "search",
    });
  }

  return (
    <section className="picker" aria-labelledby={headingId}>
      <h2 id={headingId}>{props.label}</h2>
      {props.value ? (
        <div className="picked">
          <span>{props.value.label}</span>
          <Button variant="secondary" onPress={() => props.onChange(null)}>
            変える
          </Button>
        </div>
      ) : (
        <form onSubmit={search} className="row">
          <TextField label={`${props.label}を探す`} type="search" value={query} onChange={setQuery} />
          <Button type="submit" isDisabled={busy}>
            探す
          </Button>
        </form>
      )}
      {candidates && candidates.length === 0 ? <p>候補がありません。別の言葉で探してください。</p> : null}
      {candidates && candidates.length > 0 ? (
        <ul className="candidates" aria-label={`${props.label}の候補`}>
          {candidates.map((candidate) => (
            <li key={candidate.placeId}>
              <Button variant="secondary" onPress={() => void choose(candidate.placeId)} isDisabled={busy}>
                <span className="candidate-name">{candidate.name}</span>
                <span className="candidate-address">{candidate.address}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <ErrorNotice message={error} /> : null}
    </section>
  );
}
