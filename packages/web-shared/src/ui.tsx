import type { ReactNode } from "react";
import {
  Button as AriaButton,
  Input,
  Label,
  TextField as AriaTextField,
  type ButtonProps,
} from "react-aria-components";

// WS-UI（画面の部品。DEC-56 の React Aria Components）。この縦の一本が使う部品だけ。

export function Button(props: ButtonProps & { variant?: "primary" | "secondary" }) {
  const { variant = "primary", className, ...rest } = props;
  return <AriaButton {...rest} className={`button button-${variant}${className ? ` ${String(className)}` : ""}`} />;
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password" | "search";
  autoComplete?: string;
  name?: string;
}) {
  return (
    <AriaTextField
      className="field"
      value={props.value}
      onChange={props.onChange}
      type={props.type ?? "text"}
      {...(props.autoComplete ? { autoComplete: props.autoComplete } : {})}
      {...(props.name ? { name: props.name } : {})}
    >
      <Label>{props.label}</Label>
      <Input />
    </AriaTextField>
  );
}

// 結果を読み上げる（aria-live="polite"）。
export function StatusRegion(props: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="status">
      {props.children}
    </div>
  );
}

// エラーの文と問い合わせ番号（トレース ID）を並べる（ELM-03 の WS-UI の ErrorNotice）。
export function ErrorNotice(props: { message: string; traceId?: string | undefined; children?: ReactNode }) {
  return (
    <div role="alert" className="error">
      <p>{props.message}</p>
      {props.traceId ? <p className="trace">問い合わせ番号: {props.traceId}</p> : null}
      {props.children}
    </div>
  );
}
