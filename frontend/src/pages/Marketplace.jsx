import React, { useState } from "react";
import {
  Plus,
  Star,
  ShieldCheck,
  Camera,
  Calculator,
  Cpu,
  BookOpen,
  ShoppingBag,
} from "lucide-react";
import { useCampus } from "../App";
import { students, today, dateIn, rentalSteps } from "../data/seed";
import { uid } from "../logic";
import {
  Heading,
  Panel,
  Badge,
  Modal,
  Form,
  Field,
  Timeline,
  Empty,
  Avatar,
  Metric,
} from "../components/ui";
const cats = [
  "Electronics",
  "Academic",
  "Project Equipment",
  "Books",
  "Photography",
  "Gaming",
  "Other",
];
export default function Marketplace({ rentalsPage = false }) {
  const { db, setDb, user, role, toast, notify } = useCampus();
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("All"),
    [max, setMax] = useState(""),
    [location, setLocation] = useState("All"),
    [condition, setCondition] = useState("All"),
    [rating, setRating] = useState("0"),
    [availability, setAvailability] = useState("All"),
    [tab, setTab] = useState(rentalsPage ? "My rentals" : "Explore"),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState(null),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(dateIn(1));
  const [rental, setRental] = useState(null);
  const p = db.products.find((p) => p.id === selected),
    r = db.rentals.find((r) => r.id === rental);
  const days = Math.max(
    1,
    Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1,
  );
  const products = db.products.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) &&
      (category === "All" || p.category === category) &&
      (!max || p.price <= +max) &&
      (location === "All" || p.location === location) &&
      (condition === "All" || p.condition === condition) &&
      p.rating >= +rating &&
      (availability === "All" || p.available) &&
      (tab !== "My products" || p.owner === user.id),
  );
  const rentals = db.rentals.filter(
    (r) => r.student === user.id || r.owner === user.id || role === "Admin",
  );
  const step = (r, status, comment = "") => {
    setDb((d) => ({
      ...d,
      rentals: d.rentals.map((x) =>
        x.id === r.id
          ? {
              ...x,
              status,
              timeline: [...x.timeline, { status, comment, at: Date.now() }],
            }
          : x,
      ),
    }));
    notify("Rental " + status, r.productName, "Student", "/rentals");
    toast("Rental updated · " + status);
  };
  return (
    <>
      <Heading
        eyebrow="CAMPUSRENT / BORROW MORE. BUY LESS."
        title={rentalsPage ? "Your rental workspace" : "Good things. Shared."}
        description="Find what you need, from people on your campus."
      >
        {role === "Student" && (
          <button className="primary" onClick={() => setCreate(true)}>
            <Plus size={17} />
            List an item
          </button>
        )}
      </Heading>
      <div className="tabs">
        {["Explore", "My products", "My rentals", "Owner dashboard"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      {tab === "Explore" || tab === "My products" ? (
        <>
          <div className="market-banner">
            <div>
              <Badge>THE CAMPUS CIRCULAR ECONOMY</Badge>
              <h2>
                Your next project doesn’t
                <br />
                need a new purchase.
              </h2>
              <p>
                Calculators, cameras, creative tools. A little closer to you.
              </p>
            </div>
            <ShoppingBag size={90} />
          </div>
          <div className="toolbar">
            <input
              className="filter-input"
              aria-label="Search products"
              placeholder="Search calculators, laptops, cameras..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              aria-label="Product category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["All", ...cats].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              className="filter-input"
              aria-label="Maximum daily price"
              type="number"
              min="0"
              placeholder="Max ₹ / day"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
            <select
              aria-label="Pickup location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              {["All", ...new Set(db.products.map((p) => p.location))].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
            <select
              aria-label="Condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              {["All", "Like new", "Good", "Fair"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Minimum rating"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="0">All ratings</option>
              <option value="4">4+ stars</option>
              <option value="4.8">4.8+ stars</option>
            </select>
            <select
              aria-label="Availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            >
              <option>All</option>
              <option>Available</option>
            </select>
          </div>
          <div className="card-grid">
            {products.map((p) => {
              const Icon =
                {
                  calculator: Calculator,
                  camera: Camera,
                  chip: Cpu,
                  book: BookOpen,
                }[p.art] || ShoppingBag;
              return (
                <article className="product-card" key={p.id}>
                  <button
                    className={"product-art " + p.art}
                    onClick={() => setSelected(p.id)}
                    aria-label={"View " + p.name}
                  >
                    <Icon size={74} strokeWidth={1.1} />
                    <span>
                      <Badge>{p.condition}</Badge>
                    </span>
                  </button>
                  <div className="product-body">
                    <div className="split">
                      <small>{p.category}</small>
                      <span className="rating">
                        <Star size={12} />
                        {p.rating || "New"}
                      </span>
                    </div>
                    <h3>{p.name}</h3>
                    <p>
                      {p.location} ·{" "}
                      {students.find((s) => s.id === p.owner)?.name}
                    </p>
                    <div className="split spacer">
                      <div>
                        <b>₹{p.price}</b>
                        <small> / day</small>
                      </div>
                      <button onClick={() => setSelected(p.id)}>
                        View item
                      </button>
                    </div>
                    <small>₹{p.deposit} refundable deposit</small>
                  </div>
                </article>
              );
            })}
          </div>
          {!products.length && <Empty text="No items match these filters" />}
        </>
      ) : (
        <>
          <div className="metrics">
            <Metric
              label="Active rentals"
              value={
                rentals.filter(
                  (r) => !["Completed", "Rejected"].includes(r.status),
                ).length
              }
              icon={ShoppingBag}
            />
            <Metric
              label="Rental requests"
              value={
                rentals.filter(
                  (r) => r.owner === user.id && r.status === "Requested",
                ).length
              }
              icon={BookOpen}
            />
            <Metric
              label="Your listings"
              value={db.products.filter((p) => p.owner === user.id).length}
              icon={ShoppingBag}
            />
            <Metric
              label="Completed earnings"
              value={
                "₹" +
                rentals
                  .filter(
                    (r) => r.owner === user.id && r.status === "Completed",
                  )
                  .reduce((n, r) => n + r.cost, 0)
              }
              icon={Star}
            />
          </div>
          <Panel
            title={
              tab === "Owner dashboard"
                ? "Incoming requests & rental calendar"
                : "Your rentals"
            }
          >
            {rentals
              .filter((r) => tab !== "Owner dashboard" || r.owner === user.id)
              .map((r) => (
                <div className="list-row" key={r.id}>
                  <span className="icon-chip orange">
                    <ShoppingBag />
                  </span>
                  <div>
                    <h3>{r.productName}</h3>
                    <small>
                      {r.from} → {r.to} ·{" "}
                      {r.owner === user.id
                        ? "You are the owner"
                        : "You are the borrower"}
                    </small>
                    <small>
                      ₹{r.cost} rental + ₹{r.deposit} deposit
                    </small>
                    {r.review && (
                      <small>
                        ★ {r.rating} · {r.review}
                      </small>
                    )}
                  </div>
                  <Badge>{r.status}</Badge>
                  <button onClick={() => setRental(r.id)}>Manage</button>
                </div>
              ))}
            {!rentals.length && (
              <Empty
                text="Nothing borrowed. Yet."
                detail="Find an item or list one to start a rental."
              />
            )}
          </Panel>
        </>
      )}
      {create && (
        <Modal
          title="Share an item with your campus"
          onClose={() => setCreate(false)}
        >
          <Form
            submit="List product"
            onSubmit={(f) => {
              if (f.to < f.from)
                return toast("Availability end must follow the start date.");
              setDb((d) => ({
                ...d,
                products: [
                  {
                    ...f,
                    id: uid("P"),
                    owner: user.id,
                    price: +f.price,
                    deposit: +f.deposit,
                    imageName: f.images?.name || "",
                    rating: 0,
                    available: true,
                    art: "book",
                  },
                  ...d.products,
                ],
              }));
              setCreate(false);
              setTab("My products");
              toast("Your item is now listed.");
            }}
          >
            <Field label="Product name" name="name" />
            <Field label="Category" name="category" options={cats} />
            <Field label="Description" name="description" type="textarea" />
            <Field
              label="Product photo (filename only in this demo)"
              name="images"
              type="file"
              accept="image/*"
              required={false}
            />
            <div className="form-grid">
              <Field
                label="Price per day (₹)"
                name="price"
                type="number"
                min="1"
              />
              <Field
                label="Refundable deposit (₹)"
                name="deposit"
                type="number"
                min="0"
              />
            </div>
            <Field
              label="Condition"
              name="condition"
              options={["Like new", "Good", "Fair"]}
            />
            <div className="form-grid">
              <Field
                label="Available from"
                name="from"
                type="date"
                defaultValue={today}
              />
              <Field
                label="Available until"
                name="to"
                type="date"
                defaultValue={dateIn(90)}
              />
            </div>
            <Field label="Pickup location" name="location" />
            <Field label="Rental rules" name="rules" type="textarea" />
          </Form>
        </Modal>
      )}
      {p && (
        <Modal title={p.name} onClose={() => setSelected(null)}>
          <div className="split">
            <Badge>{p.condition}</Badge>
            <span className="rating">
              <Star size={14} />
              {p.rating || "New listing"}
            </span>
          </div>
          <p className="spacer">{p.description}</p>
          <div className="list-row">
            <Avatar name={students.find((s) => s.id === p.owner)?.name} />
            <div>
              <b>{students.find((s) => s.id === p.owner)?.name}</b>
              <small>
                Verified campus member ·{" "}
                {
                  db.rentals.filter(
                    (r) => r.owner === p.owner && r.status === "Completed",
                  ).length
                }{" "}
                completed rentals
              </small>
            </div>
            <ShieldCheck size={21} />
          </div>
          <div className="detail-grid">
            <div>
              <small>Price / deposit</small>
              <b>
                ₹{p.price} per day · ₹{p.deposit}
              </b>
            </div>
            <div>
              <small>Pickup</small>
              <b>{p.location}</b>
            </div>
            <div>
              <small>Available dates</small>
              <b>
                {p.from} → {p.to}
              </b>
            </div>
            <div>
              <small>Rules</small>
              <b>{p.rules}</b>
            </div>
          </div>
          {p.owner !== user.id && role === "Student" ? (
            <Form
              submit="Request rental"
              onSubmit={() => {
                if (to < from || from < today || from < p.from || to > p.to)
                  return toast(
                    "Choose valid dates within the available period.",
                  );
                if (
                  db.rentals.some(
                    (r) =>
                      r.product === p.id &&
                      !["Rejected", "Completed"].includes(r.status) &&
                      from <= r.to &&
                      to >= r.from,
                  )
                )
                  return toast(
                    "This item already has a rental in those dates. Choose another date range.",
                  );
                const rent = {
                  id: uid("RENT"),
                  product: p.id,
                  productName: p.name,
                  owner: p.owner,
                  student: user.id,
                  from,
                  to,
                  days,
                  cost: days * p.price,
                  deposit: p.deposit,
                  status: "Requested",
                  timeline: [
                    {
                      status: "Requested",
                      comment: "Waiting for the owner to accept.",
                      at: Date.now(),
                    },
                  ],
                };
                setDb((d) => ({ ...d, rentals: [rent, ...d.rentals] }));
                notify("New rental request", p.name, "Student", "/rentals");
                setSelected(null);
                setRental(rent.id);
                toast("Rental request sent to owner.");
              }}
            >
              <div className="form-grid">
                <Field
                  label="Pickup date"
                  type="date"
                  value={from}
                  min={p.from > today ? p.from : today}
                  max={p.to}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <Field
                  label="Return date"
                  type="date"
                  min={from}
                  max={p.to}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="notice">
                {days} days × ₹{p.price} + ₹{p.deposit} deposit ={" "}
                <b>₹{days * p.price + p.deposit}</b>
                <br />
                Payment is simulated. No money is collected.
              </div>
            </Form>
          ) : (
            <p>
              {p.owner === user.id
                ? "This is your listing. Switch to another student account to request it."
                : "Admin monitoring view."}
            </p>
          )}
        </Modal>
      )}
      {r && (
        <Modal
          title={r.productName + " · " + r.id}
          onClose={() => setRental(null)}
        >
          <Badge>{r.status}</Badge>
          <p className="spacer">
            {r.from} → {r.to} · Total ₹{r.cost + r.deposit}
          </p>
          <Timeline items={r.timeline} />
          <div className="inline-actions spacer">
            {r.owner === user.id && r.status === "Requested" && (
              <>
                <button className="primary" onClick={() => step(r, "Accepted")}>
                  Accept request
                </button>
                <button onClick={() => step(r, "Rejected")}>
                  Reject request
                </button>
              </>
            )}
            {r.student === user.id && r.status === "Accepted" && (
              <button
                className="primary"
                onClick={() => step(r, "Payment Pending")}
              >
                Continue to simulated payment
              </button>
            )}
            {r.student === user.id && r.status === "Payment Pending" && (
              <button
                className="primary"
                onClick={() =>
                  step(
                    r,
                    "Confirmed",
                    "Simulated payment confirmed. No actual charge.",
                  )
                }
              >
                Confirm simulated payment
              </button>
            )}
            {r.owner === user.id && r.status === "Confirmed" && (
              <button
                className="primary"
                onClick={() => step(r, "Handed Over")}
              >
                Confirm handover
              </button>
            )}
            {r.student === user.id && r.status === "Handed Over" && (
              <button className="primary" onClick={() => step(r, "Returned")}>
                Mark returned
              </button>
            )}
            {r.owner === user.id && r.status === "Returned" && (
              <button
                className="primary"
                onClick={() =>
                  step(
                    r,
                    "Completed",
                    "Return confirmed. Deposit release simulated.",
                  )
                }
              >
                Confirm return & complete
              </button>
            )}
          </div>
          {r.status === "Completed" && r.student === user.id && !r.review && (
            <Form
              submit="Post review"
              onSubmit={(f) => {
                setDb((d) => ({
                  ...d,
                  rentals: d.rentals.map((x) =>
                    x.id === r.id
                      ? { ...x, review: f.review, rating: +f.rating }
                      : x,
                  ),
                  products: d.products.map((p) =>
                    p.id === r.product ? { ...p, rating: +f.rating } : p,
                  ),
                }));
                toast("Thanks for reviewing your rental.");
              }}
            >
              <Field
                label="Rating"
                name="rating"
                options={["5", "4", "3", "2", "1"]}
              />
              <Field label="Your review" name="review" type="textarea" />
            </Form>
          )}
          <Form
            submit="Add rental message"
            onSubmit={(f, form) => {
              step(r, r.status, user.name + ": " + f.message);
              form.reset();
            }}
          >
            <Field
              label="Message to the other participant (local demo)"
              name="message"
            />
          </Form>
        </Modal>
      )}
    </>
  );
}
