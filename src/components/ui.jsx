import React, { useEffect, useRef } from "react";
import { X, ArrowUpRight, ChevronRight, Inbox } from "lucide-react";
export const Badge = ({ children }) => (
  <span
    className={
      "badge " +
      (/approved|synced|resolved|completed|available|on track|accepted|confirmed/i.test(
        children,
      )
        ? "green"
        : /risk|critical|reject|breach/i.test(children)
          ? "red"
          : /review|pending|watch|reserved|requested|investigation/i.test(
                children,
              )
            ? "amber"
            : "blue")
    }
  >
    {children}
  </span>
);
export const Empty = ({
  text = "Nothing here yet",
  detail = "New activity will appear here.",
}) => (
  <div className="empty">
    <Inbox size={32} />
    <h3>{text}</h3>
    <p>{detail}</p>
  </div>
);
export const Panel = ({
  title,
  subtitle,
  action,
  children,
  className = "",
}) => (
  <section className={"panel " + className}>
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);
export const Heading = ({ eyebrow, title, description, children }) => (
  <div className="page-heading">
    <div>
      <span className="eyebrow">{eyebrow || "YOUR CONNECTED CAMPUS"}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    <div className="actions">{children}</div>
  </div>
);
export const Metric = ({
  label,
  value,
  detail,
  icon: Icon,
  color = "blue",
}) => (
  <div className="metric">
    <div className="metric-top">
      <span>{label}</span>
      <span className={"icon-chip " + color}>{Icon && <Icon size={19} />}</span>
    </div>
    <strong>{value}</strong>
    <small>{detail || "Across your campus"}</small>
  </div>
);
export function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const old = document.activeElement;
    ref.current.showModal();
    return () => {
      old?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Field({
  label,
  name,
  type = "text",
  options,
  required = true,
  defaultValue,
  ...rest
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {options ? (
        <select
          name={name}
          defaultValue={defaultValue}
          required={required}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>
              {o.label ?? o}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          name={name}
          required={required}
          defaultValue={defaultValue}
          rows={3}
          {...rest}
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          {...rest}
        />
      )}
    </label>
  );
}
export const Form = ({ children, onSubmit, submit = "Save changes" }) => (
  <form
    className="form"
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit(
        Object.fromEntries(new FormData(e.currentTarget)),
        e.currentTarget,
      );
    }}
  >
    {children}
    <div className="form-footer">
      <button className="primary" type="submit">
        {submit}
        <ChevronRight size={16} />
      </button>
    </div>
  </form>
);
export const Timeline = ({ items = [] }) => (
  <div className="timeline">
    {items.map((x, i) => (
      <div key={i}>
        <span className="timeline-dot" />
        <div>
          <b>{x.status || x.title}</b>
          <p>{x.comment || x.detail}</p>
          <small>{new Date(x.at).toLocaleString()}</small>
        </div>
      </div>
    ))}
  </div>
);
export const Progress = ({ value }) => (
  <div className="progress">
    <span style={{ width: Math.max(0, Math.min(100, value)) + "%" }} />
  </div>
);
export const Avatar = ({ name = "", small = false }) => (
  <span className={"avatar " + (small ? "small" : "")}>
    {name
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")}
  </span>
);
export const LinkButton = ({ children, onClick }) => (
  <button className="text-button" onClick={onClick}>
    {children}
    <ArrowUpRight size={15} />
  </button>
);
