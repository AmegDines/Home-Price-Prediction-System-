"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  fetchHealth,
  fetchLocations,
  fetchPrediction,
  type ApiError,
  type HealthData,
  type PredictionResult,
} from "@/utils/predictor";
import {
  addStoredListing,
  analyzeAskingPrice,
  getOfflineListings,
  getStoredListings,
  type HomeListing,
} from "@/utils/listings";

type Page = "home" | "predict" | "sell" | "listings" | "detail";
type IconName = "arrow" | "bath" | "bed" | "building" | "check" | "chevron" | "grid" | "heart" | "home" | "list" | "location" | "menu" | "minus" | "plus" | "search" | "sparkles" | "upload" | "x";

const photos = [
  "https://images.unsplash.com/photo-1645237455598-e8f02d706a4e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200",
  "https://images.unsplash.com/photo-1735901228503-7718d594f789?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200",
  "https://images.unsplash.com/photo-1640912744459-0aea6e0b1bd5?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200",
  "https://images.unsplash.com/photo-1633605015660-b0f2dbad3bf2?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200",
];

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    bath: <><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3Z" /><path d="M7 12V5a2 2 0 0 1 3.7-1.1" /><path d="M5 19v2M19 19v2" /></>,
    bed: <><path d="M3 18v-6h18v6M3 15h18" /><path d="M5 12V7h6a3 3 0 0 1 3 3v2M14 9h3a4 4 0 0 1 4 4" /></>,
    building: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M10 21v-3h4v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    minus: <path d="M5 12h14" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" /><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 14l.6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6L5 14Z" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
    x: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Button({ children, variant = "primary", onClick, type = "button", className = "", disabled = false }: {
  children: ReactNode; variant?: "primary" | "secondary" | "ghost"; onClick?: () => void;
  type?: "button" | "submit"; className?: string; disabled?: boolean;
}) {
  return <button type={type} className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Logo({ onClick }: { onClick: () => void }) {
  return <button className="logo" onClick={onClick} aria-label="Niva home"><span><Icon name="building" size={19} /></span><b>Niva</b></button>;
}

function Navbar({ page, go }: { page: Page; go: (page: Page) => void }) {
  const [open, setOpen] = useState(false);
  const links: [string, Page][] = [["Home", "home"], ["Predict", "predict"], ["Sell", "sell"], ["Listings", "listings"]];
  return <header className="navbar"><div className="nav-inner">
    <Logo onClick={() => go("home")} />
    <nav className={open ? "nav-links open" : "nav-links"} aria-label="Main navigation">
      {links.map(([label, target]) => <button key={target} aria-current={page === target ? "page" : undefined} className={page === target ? "active" : ""} onClick={() => { go(target); setOpen(false); }}>{label}</button>)}
    </nav>
    <Button className="nav-cta" onClick={() => go("sell")}>List Your Home <Icon name="arrow" size={17} /></Button>
    <button className="menu-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle navigation"><Icon name={open ? "x" : "menu"} /></button>
  </div></header>;
}

function BottomNav({ page, go }: { page: Page; go: (page: Page) => void }) {
  const links: [string, Page, IconName][] = [["Home", "home", "home"], ["Predict", "predict", "sparkles"], ["Sell", "sell", "plus"], ["Listings", "listings", "grid"]];
  return <nav className="bottom-nav" aria-label="Mobile navigation">{links.map(([label, target, icon]) => <button key={target} aria-current={page === target ? "page" : undefined} className={page === target ? "active" : ""} onClick={() => go(target)}><Icon name={icon} size={20} /><span>{label}</span></button>)}</nav>;
}

function PredictorFields({ location, setLocation, sqft, setSqft, bhk, setBhk, bathrooms, setBathrooms, compact = false, locations = [], maxBhk = 5, maxBathrooms = 5 }: {
  location: string; setLocation: (v: string) => void; sqft: number; setSqft: (v: number) => void;
  bhk: number; setBhk: (v: number) => void; bathrooms: number; setBathrooms: (v: number) => void;
  compact?: boolean; locations?: string[]; maxBhk?: number; maxBathrooms?: number;
}) {
  const listId = compact ? "locations-home" : "locations-form";
  return <div className={compact ? "predict-fields compact" : "predict-fields"}>
    <label className="field field-location"><span>Location</span><div className="input-wrap"><Icon name="location" size={18} /><input list={listId} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Search Bengaluru area" autoComplete="off" /></div></label>
    <datalist id={listId}>{locations.map((name) => <option key={name} value={name} />)}</datalist>
    <label className="field"><span>Built-up area</span><div className="unit-input"><input type="number" min="300" max="6000" step="50" value={sqft} onChange={(e) => setSqft(Math.max(300, Math.min(6000, Number(e.target.value))))} /><span>sq ft</span></div></label>
    <div className="field"><span>BHK</span><div className="chips">{Array.from({ length: maxBhk }, (_, i) => i + 1).map((n) => <button type="button" key={n} aria-pressed={bhk === n} className={bhk === n ? "chip active" : "chip"} onClick={() => setBhk(n)}>{n === 5 ? "5+" : n}</button>)}</div></div>
    <div className="field"><span>Bathrooms</span><div className="stepper"><button type="button" aria-label="Remove bathroom" onClick={() => setBathrooms(Math.max(1, bathrooms - 1))}><Icon name="minus" size={16} /></button><strong>{bathrooms}</strong><button type="button" aria-label="Add bathroom" onClick={() => setBathrooms(Math.min(maxBathrooms, bathrooms + 1))}><Icon name="plus" size={16} /></button></div></div>
  </div>;
}

const formatPrice = (lakhs: number) => lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2)} Cr` : `₹${lakhs.toFixed(1)} L`;
const getImage = (item: HomeListing) => item.imageUrl || photos[0];
const badgeTone = (badgeClass: string) => badgeClass === "deal-below" ? "green" : badgeClass === "deal-premium" ? "orange" : "blue";

function PropertyCard({ item, onOpen, list = false }: { item: HomeListing; onOpen: (item: HomeListing) => void; list?: boolean }) {
  const deal = analyzeAskingPrice(item.asking_price_lakhs, item.predicted_price_lakhs);
  const pricePerSqft = item.total_sqft ? Math.round((item.asking_price_lakhs * 100000) / item.total_sqft) : 0;
  return <article className={list ? "property-card list-card" : "property-card"}>
    <button className="property-image" onClick={() => onOpen(item)} aria-label={`View ${item.title}`}><img src={getImage(item)} alt={`${item.title} property`} /><span className={`ai-badge ${badgeTone(deal.badgeClass)}`}><Icon name="sparkles" size={13} /> {deal.badgeText}</span><span className="heart" aria-hidden="true"><Icon name="heart" size={19} /></span></button>
    <div className="property-content"><div className="price-row"><h3>{formatPrice(item.asking_price_lakhs)}</h3><span>₹{pricePerSqft.toLocaleString("en-IN")}/sq ft</span></div>
      <button className="property-title" onClick={() => onOpen(item)}>{item.title}</button>
      <p><Icon name="location" size={16} /> {item.location}, Bengaluru</p>
      <div className="facts"><span><Icon name="bed" size={17} />{item.bhk} BHK</span><span><Icon name="bath" size={17} />{item.bath} Bath</span><span><Icon name="building" size={17} />{item.total_sqft.toLocaleString()} sq ft</span></div>
    </div>
  </article>;
}

function HomePage({ go, locations, health, listings, onOpen }: { go: (page: Page) => void; locations: string[]; health: HealthData | null; listings: HomeListing[]; onOpen: (item: HomeListing) => void }) {
  const [location, setLocation] = useState(""); const [sqft, setSqft] = useState(1200); const [bhk, setBhk] = useState(2); const [bathrooms, setBathrooms] = useState(2);
  const [result, setResult] = useState<PredictionResult | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const estimate = async () => {
    if (!location.trim()) { setError("Choose a Bengaluru location to estimate a price."); return; }
    setLoading(true); setError(""); setResult(null);
    try { setResult(await fetchPrediction({ location, sqft, bhk, bath: bathrooms })); }
    catch (err) { const apiError = err as ApiError; setError(apiError.detail ?? apiError.message ?? "Prediction failed. Please retry."); }
    finally { setLoading(false); }
  };
  return <main>
    <section className="hero"><div className="hero-glow one" /><div className="hero-glow two" /><div className="hero-inner">
      <div className="hero-copy"><div className="eyebrow"><Icon name="sparkles" size={16} /> AI-powered for Bengaluru</div><h1>Know your home’s worth <em>in seconds.</em></h1><p>Get a market-informed estimate based on your home’s location, size, and configuration.</p><div className="hero-actions"><Button onClick={() => go("predict")}>Predict Price <Icon name="arrow" size={18} /></Button><Button variant="secondary" onClick={() => go("listings")}>Explore homes</Button></div></div>
      <div className="hero-visual"><img src={photos[0]} alt="Bright modern Bengaluru apartment" /><div className="floating-value"><span>Model holdout R²</span><strong>{health ? `${(health.r2_score * 100).toFixed(1)}%` : "Loading"}</strong><small><i /> Updated model score</small></div><div className="photo-credit">Illustrative property photo</div></div>
    </div><div className="quick-predict glass-card"><div className="quick-head"><div><span>Instant estimate</span><strong>Tell us about your home</strong></div><div className="secure"><Icon name="sparkles" size={15} /> Bengaluru price model</div></div>
      <PredictorFields compact locations={locations} {...{ location, setLocation, sqft, setSqft, bhk, setBhk, bathrooms, setBathrooms }} />
      <Button onClick={estimate} disabled={loading}>{loading ? "Getting estimate…" : "Get estimate"} <Icon name="arrow" size={17} /></Button>
      {result && <p className="quick-result" role="status">Estimated value: <strong>{formatPrice(result.predicted_price)}</strong> · Range {formatPrice(result.confidence_range[0])}–{formatPrice(result.confidence_range[1])}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
    </div></section>
    <section className="trust-strip"><div><strong>{health?.dataset_size.toLocaleString("en-IN") ?? "—"}</strong><span>cleaned transactions</span></div><i /><div><strong>{health ? `${(health.r2_score * 100).toFixed(1)}%` : "—"}</strong><span>holdout R² score</span></div><i /><div><strong>100%</strong><span>Bengaluru-focused</span></div></section>
    <section className="section"><div className="section-heading centered"><span className="kicker">Simple by design</span><h2>From curious to confident in 3 steps</h2><p>Use a local price estimate to understand the market and decide what to do next.</p></div><div className="steps">{[["01", "location", "Enter your details", "Share the location, size, bedrooms and bathrooms."], ["02", "sparkles", "Get your AI estimate", "The model compares your home with Bengaluru transaction data."], ["03", "home", "List or explore", "Use the estimate to price a home or explore local listings."]].map(([n, icon, title, text]) => <article className="step-card" key={n}><span className="step-num">{n}</span><div className="step-icon"><Icon name={icon as IconName} size={24} /></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="section featured"><div className="section-heading heading-row"><div><span className="kicker">Bengaluru homes</span><h2>Explore current listings</h2></div><button onClick={() => go("listings")}>View all listings <Icon name="arrow" size={18} /></button></div>
      {listings.length ? <div className="property-grid home-grid">{listings.slice(0, 3).map((item) => <PropertyCard key={item.id} item={item} onOpen={onOpen} />)}</div> : <div className="no-results"><h2>No listings yet</h2><p>Be the first to add a home to the listings board.</p><Button onClick={() => go("sell")}>List your home</Button></div>}
    </section><section className="cta-banner section"><div><span className="kicker light">For homeowners</span><h2>Ready to make your next move?</h2><p>Get a live valuation and prepare a listing for Bengaluru buyers.</p></div><Button onClick={() => go("sell")}>List Your Home <Icon name="arrow" size={18} /></Button></section>
  </main>;
}

function PredictorPage({ go, locations }: { go: (page: Page) => void; locations: string[] }) {
  const [location, setLocation] = useState(""); const [sqft, setSqft] = useState(1200); const [bhk, setBhk] = useState(2); const [bathrooms, setBathrooms] = useState(2);
  const [status, setStatus] = useState<"empty" | "loading" | "result" | "error">("empty"); const [prediction, setPrediction] = useState<PredictionResult | null>(null); const [error, setError] = useState("");
  const predict = async () => {
    if (!location.trim()) { setError("Choose a Bengaluru location to continue."); setStatus("error"); return; }
    setStatus("loading"); setError("");
    try { setPrediction(await fetchPrediction({ location, sqft, bhk, bath: bathrooms })); setStatus("result"); }
    catch (err) { const apiError = err as ApiError; setError(apiError.detail ?? apiError.message ?? "Prediction failed. Please retry."); setStatus("error"); }
  };
  const pricePerSqft = prediction ? Math.round(prediction.predicted_price * 100000 / sqft) : 0;
  const lowPerSqft = prediction ? Math.round(prediction.confidence_range[0] * 100000 / sqft) : 0;
  const highPerSqft = prediction ? Math.round(prediction.confidence_range[1] * 100000 / sqft) : 0;
  const chartMax = Math.max(highPerSqft, 1) * 1.15;
  return <main className="page-shell"><div className="page-heading"><span className="eyebrow"><Icon name="sparkles" size={15} /> Bengaluru AI valuation</span><h1>What is your home worth?</h1><p>Get a data-backed estimate using your home’s location and property details.</p></div>
    <div className="predict-layout"><section className="form-card"><div className="card-title"><span>1</span><div><h2>Property details</h2><p>Tell us the basics about your home</p></div></div>
      <PredictorFields locations={locations} {...{ location, setLocation, sqft, setSqft, bhk, setBhk, bathrooms, setBathrooms }} />
      <div className="slider-block"><div><span>Built-up area</span><strong>{sqft.toLocaleString()} sq ft</strong></div><input aria-label="Built-up area" type="range" min="300" max="6000" step="50" value={sqft} onChange={(e) => setSqft(Number(e.target.value))} /><div className="range-labels"><span>300 sq ft</span><span>6,000 sq ft</span></div></div>
      {status === "error" && <p className="error-text" role="alert">{error}</p>}
      <Button className="full-btn" onClick={predict} disabled={status === "loading"}>{status === "loading" ? "Analysing local market…" : "Calculate my home value"} <Icon name="sparkles" size={18} /></Button>
      <p className="privacy"><Icon name="check" size={15} /> Only property details are sent to the valuation API.</p>
    </section><section className={`result-card ${status}`} aria-live="polite">
      {status === "empty" && <div className="empty-result"><div className="orb"><Icon name="sparkles" size={30} /></div><h2>Your valuation will appear here</h2><p>Complete the property details and calculate an estimate.</p><div className="empty-lines"><span /><span /><span /></div></div>}
      {status === "loading" && <div className="loading-result"><div className="loader-orbit"><Icon name="sparkles" size={28} /></div><h2>Analysing local market data…</h2><p>Sending your property details to the Bengaluru valuation model.</p><div className="progress-line"><span /></div></div>}
      {status === "error" && <div className="empty-result"><div className="orb"><Icon name="x" size={25} /></div><h2>We couldn’t calculate that</h2><p>{error}</p><Button variant="secondary" onClick={predict}>Try again</Button></div>}
      {status === "result" && prediction && <div className="valuation"><div className="result-head"><span><Icon name="sparkles" size={15} /> AI estimated value</span><small>Model estimate</small></div><p>Based on similar homes in {location}</p><h2>{formatPrice(prediction.predicted_price)}</h2>
        <div className="estimate-range"><span>Estimated range</span><strong>{formatPrice(prediction.confidence_range[0])} — {formatPrice(prediction.confidence_range[1])}</strong></div>
        <div className="metric-row"><div><span>Estimated price / sq ft</span><strong>₹{pricePerSqft.toLocaleString("en-IN")}</strong></div><div><span>Estimated range width</span><strong>{formatPrice(prediction.confidence_range[1] - prediction.confidence_range[0])}</strong></div></div>
        <div className="chart"><div className="chart-head"><strong>Estimated price range / sq ft</strong><span>₹ / sq ft</span></div><div className="bar-row"><span>Low estimate</span><i><b style={{ width: `${Math.max(4, lowPerSqft / chartMax * 100)}%` }} /></i><strong>₹{lowPerSqft.toLocaleString("en-IN")}</strong></div><div className="bar-row avg"><span>High estimate</span><i><b style={{ width: `${Math.max(4, highPerSqft / chartMax * 100)}%` }} /></i><strong>₹{highPerSqft.toLocaleString("en-IN")}</strong></div></div>
        <div className="result-actions"><Button onClick={() => go("sell")}>List your home</Button><Button variant="secondary" onClick={() => go("listings")}>Explore listings</Button></div><p className="estimate-disclaimer">Estimates are model outputs and may differ from a property’s final sale price.</p>
      </div>}
    </section></div></main>;
}

function SellerPage({ locations, onPublished }: { locations: string[]; onPublished: (listing: HomeListing) => void }) {
  const [step, setStep] = useState(0); const [title, setTitle] = useState(""); const [location, setLocation] = useState(""); const [sqft, setSqft] = useState(1200); const [bhk, setBhk] = useState(2); const [bathrooms, setBathrooms] = useState(2); const [balcony, setBalcony] = useState(1); const [price, setPrice] = useState(80);
  const [sellerName, setSellerName] = useState(""); const [sellerPhone, setSellerPhone] = useState("");
  const [valuation, setValuation] = useState<PredictionResult | null>(null); const [valuationLoading, setValuationLoading] = useState(false); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    if (!location || sqft < 1) { setValuation(null); return; }
    let active = true; const timer = window.setTimeout(() => { setValuationLoading(true); fetchPrediction({ location, sqft, bhk, bath: bathrooms }).then((r) => { if (active) setValuation(r); }).catch(() => { if (active) setValuation(null); }).finally(() => { if (active) setValuationLoading(false); }); }, 500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [location, sqft, bhk, bathrooms]);
  const estimate = valuation?.predicted_price ?? 0; const variance = estimate ? Math.round((price - estimate) / estimate * 100) : 0;
  const badge = estimate ? analyzeAskingPrice(price, estimate) : { badgeText: "Enter property details", badgeClass: "deal-fair", differencePct: 0 };
  const stepLabels = ["Property details", "Pricing", "Photos", "Review"];
  const next = () => {
    setError("");
    if (step === 0 && (!title.trim() || !location.trim())) { setError("Add a listing title and choose a Bengaluru location."); return; }
    if (step === 1 && (!valuation || price <= 0)) { setError("Wait for the AI valuation and enter a valid asking price."); return; }
    if (step < 3) setStep(step + 1);
  };
  const publish = async () => {
    if (!sellerName.trim() || !sellerPhone.trim()) { setError("Add the seller name and phone number before publishing."); return; }
    if (!valuation) { setError("A live AI valuation is required before publishing."); return; }
    setSubmitting(true); setError("");
    try {
      const listing = await addStoredListing({ title: title.trim(), location, bhk, bath: bathrooms, total_sqft: sqft, balcony, asking_price_lakhs: price, seller_name: sellerName.trim(), seller_phone: sellerPhone.trim() });
      onPublished(listing);
    } catch (err) { const apiError = err as ApiError; setError(apiError.detail ?? apiError.message ?? "Could not publish your listing. Please try again."); }
    finally { setSubmitting(false); }
  };
  return <main className="page-shell seller-page"><div className="page-heading left"><span className="eyebrow">Seller hub</span><h1>List your home with confidence</h1><p>Our Bengaluru model helps you review your price as you prepare your listing.</p></div>
    <div className="progress-steps">{stepLabels.map((label, i) => <button type="button" key={label} className={i === step ? "active" : i < step ? "done" : ""} onClick={() => { if (i <= step) setStep(i); }} aria-current={i === step ? "step" : undefined}><span>{i < step ? <Icon name="check" size={14} /> : i + 1}</span><em>{label}</em></button>)}</div>
    <div className="seller-layout"><section className="form-card seller-form">
      {step === 0 && <><div className="card-title plain"><div><h2>Tell us about your property</h2><p>Accurate details help us create a better valuation.</p></div></div><label className="field full"><span>Listing title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bright 2 BHK near Whitefield" maxLength={90} /></label><PredictorFields locations={locations} maxBhk={4} maxBathrooms={4} {...{ location, setLocation, sqft, setSqft, bhk, setBhk, bathrooms, setBathrooms }} /><div className="field"><span>Balconies</span><div className="chips">{[0, 1, 2, 3].map((n) => <button type="button" key={n} aria-pressed={balcony === n} className={balcony === n ? "chip active" : "chip"} onClick={() => setBalcony(n)}>{n}</button>)}</div></div></>}
      {step === 1 && <><div className="card-title plain"><div><h2>Set your asking price</h2><p>Use the live AI valuation as a starting point.</p></div></div><label className="field full"><span>Asking price in Lakhs</span><div className="price-input"><strong>₹</strong><input type="number" min="15" max="600" step="5" value={price} onChange={(e) => setPrice(Number(e.target.value))} /><span>Lakhs</span></div></label><div className="price-tips"><strong>Pricing guidance</strong><p>Compare your asking price with the current model estimate and its estimated range.</p></div></>}
      {step === 2 && <><div className="card-title plain"><div><h2>Show your home at its best</h2><p>Photos are visual previews; listing photos are not uploaded to cloud storage.</p></div></div><div className="upload-zone photo-upload-preview"><span><Icon name="upload" size={27} /></span><strong>Property photos</strong><p>Photo upload is not connected to listing storage yet.</p></div><div className="upload-tip"><Icon name="sparkles" size={20} /><p><strong>Photo tip</strong><br />Use natural light and landscape orientation for a clear preview.</p></div></>}
      {step === 3 && <><div className="card-title plain"><div><h2>Review your listing</h2><p>Check the details and add contact information before publishing.</p></div></div><div className="review-card"><img src={photos[0]} alt="Property preview" /><div><span className={`value-pill ${badgeTone(badge.badgeClass)}`}>{badge.badgeText}</span><h3>{title || `${bhk} BHK in ${location}`}</h3><p>{location} · {sqft.toLocaleString()} sq ft · {bathrooms} bathrooms · {balcony} balconies</p><strong>{formatPrice(price)}</strong></div></div><label className="field full"><span>Seller name</span><input value={sellerName} onChange={(e) => setSellerName(e.target.value)} autoComplete="name" /></label><label className="field full"><span>Phone number</span><input type="tel" value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} autoComplete="tel" placeholder="+91 98765 43210" /></label></>}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="form-nav">{step > 0 && <Button variant="secondary" onClick={() => { setError(""); setStep(step - 1); }}>Back</Button>}{step < 3 ? <Button onClick={next}>Save & continue <Icon name="arrow" size={17} /></Button> : <Button onClick={publish} disabled={submitting}>{submitting ? "Publishing…" : "Publish listing"} <Icon name="arrow" size={17} /></Button>}</div>
    </section><aside className="valuation-panel"><div className="panel-label"><Icon name="sparkles" size={16} /> Live AI valuation</div><p>Estimated market value</p><h2>{valuationLoading ? "Updating…" : estimate ? formatPrice(estimate) : "Add property details"}</h2><span className={`value-pill ${badgeTone(badge.badgeClass)}`}>{badge.badgeText}</span>
      {valuation && <div className="valuation-range"><div><span>Model range</span><strong>{formatPrice(valuation.confidence_range[0])} – {formatPrice(valuation.confidence_range[1])}</strong></div><div className="range-track"><span style={{ left: `${Math.max(4, Math.min(94, 50 + variance * 2))}%` }} /></div><div className="range-ends"><span>Asking price {formatPrice(price)}</span><span>Difference {variance > 0 ? "+" : ""}{variance}%</span></div></div>}
      <div className="valuation-factors"><strong>Estimate inputs</strong><p><Icon name="check" size={15} /> {location || "Choose a locality"}</p><p><Icon name="check" size={15} /> {bhk} BHK · {bathrooms} bathrooms</p><p><Icon name="check" size={15} /> {sqft.toLocaleString()} sq ft</p></div><small>The API updates this estimate as property details change.</small>
    </aside></div></main>;
}

function ListingsPage({ listings, ready, onOpen, go, locations }: { listings: HomeListing[]; ready: boolean; onOpen: (item: HomeListing) => void; go: (page: Page) => void; locations: string[] }) {
  const [area, setArea] = useState("All locations"); const [bhk, setBhk] = useState(0); const [budget, setBudget] = useState(600); const [view, setView] = useState<"grid" | "list">("grid"); const [search, setSearch] = useState(""); const [sort, setSort] = useState("recommended");
  const filtered = useMemo(() => {
    const rows = listings.filter((item) => (area === "All locations" || item.location === area) && (!bhk || (bhk === 4 ? item.bhk >= 4 : item.bhk === bhk)) && item.asking_price_lakhs <= budget && (!search.trim() || `${item.title} ${item.location}`.toLowerCase().includes(search.toLowerCase())));
    if (sort === "price-low") rows.sort((a, b) => a.asking_price_lakhs - b.asking_price_lakhs);
    if (sort === "newest") rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows;
  }, [listings, area, bhk, budget, search, sort]);
  return <main className="listings-page"><div className="listings-hero"><span className="kicker">Discover Bengaluru</span><h1>Find a home that’s priced right</h1><p>Compare seller asking prices with the model’s independent estimate.</p><div className="search-bar"><Icon name="search" /><input aria-label="Search listings" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by locality or listing title" /><Button variant="secondary" onClick={() => setSearch("")}>Clear</Button></div></div>
    <div className="filter-bar"><label><span>Location</span><select value={area} onChange={(e) => setArea(e.target.value)}><option>All locations</option>{[...new Set([...locations, ...listings.map((x) => x.location)])].sort().map((x) => <option key={x}>{x}</option>)}</select></label>
      <div className="filter-bhk"><span>BHK</span><div>{[0, 1, 2, 3, 4].map((n) => <button type="button" key={n} aria-pressed={bhk === n} onClick={() => setBhk(n)} className={bhk === n ? "active" : ""}>{n ? `${n}${n === 4 ? "+" : ""} BHK` : "Any"}</button>)}</div></div>
      <label className="budget-filter"><span>Budget up to <b>₹{budget}L</b></span><input aria-label="Maximum budget in Lakhs" type="range" min="50" max="600" step="10" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></label>
      <label><span>Sort by</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="recommended">Recommended</option><option value="price-low">Price: Low to high</option><option value="newest">Newest first</option></select></label>
    </div>
    <section className="listings-content"><div className="results-head"><div><h2>{ready ? `${filtered.length} homes in Bengaluru` : "Loading listings…"}</h2><p>Shared listings with AI price checks</p></div><div className="view-toggle"><button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Grid view"><Icon name="grid" size={18} /></button><button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="List view"><Icon name="list" size={18} /></button></div></div>
      {!ready ? <div className={view === "grid" ? "property-grid" : "property-grid list-view"}>{[1, 2, 3].map((n) => <div className="skeleton-card" key={n}><span /><div><i /><i /><i /></div></div>)}</div> : filtered.length ? <div className={view === "grid" ? "property-grid" : "property-grid list-view"}>{filtered.map((item) => <PropertyCard key={item.id} item={item} onOpen={onOpen} list={view === "list"} />)}</div> : <div className="no-results"><div><Icon name="search" size={29} /></div><h2>No homes match these filters</h2><p>Try widening your budget or choosing a different location.</p><Button variant="secondary" onClick={() => { setArea("All locations"); setBhk(0); setBudget(600); setSearch(""); }}>Clear all filters</Button><p className="empty-cta">Want to add a home? <button onClick={() => go("sell")}>List your home</button></p></div>}
    </section></main>;
}

function DetailPage({ item, go }: { item: HomeListing | null; go: (page: Page) => void }) {
  if (!item) return <main className="detail-page"><h1>Choose a listing to view</h1><Button onClick={() => go("listings")}>Browse listings</Button></main>;
  const deal = analyzeAskingPrice(item.asking_price_lakhs, item.predicted_price_lakhs); const images = [getImage(item), ...photos.slice(1, 3)]; const pricePerSqft = Math.round(item.asking_price_lakhs * 100000 / item.total_sqft);
  return <main className="detail-page"><button className="back-link" onClick={() => go("listings")}><span>‹</span> Back to listings</button><section className="gallery"><div className="gallery-main"><img src={images[0]} alt={`${item.title} main view`} /></div><div>{images.slice(1, 3).map((image, i) => <img key={`${image}-${i}`} src={image} alt={`${item.title} view ${i + 2}`} />)}</div><span className="gallery-count">{images.length} photo{images.length === 1 ? "" : "s"}</span></section>
    <div className="detail-layout"><article className="detail-main"><div className="detail-heading"><div><span className={`ai-badge ${badgeTone(deal.badgeClass)}`}><Icon name="sparkles" size={13} /> {deal.badgeText}</span><h1>{item.title}</h1><p><Icon name="location" size={17} /> {item.location}, Bengaluru</p></div><div className="detail-price"><h2>{formatPrice(item.asking_price_lakhs)}</h2><p>₹{pricePerSqft.toLocaleString("en-IN")} / sq ft</p></div></div>
      <div className="key-facts"><div><Icon name="bed" /><span><strong>{item.bhk} BHK</strong>Bedrooms</span></div><div><Icon name="bath" /><span><strong>{item.bath}</strong>Bathrooms</span></div><div><Icon name="building" /><span><strong>{item.total_sqft.toLocaleString()} sq ft</strong>Built-up area</span></div><div><Icon name="home" /><span><strong>{item.balcony}</strong>Balconies</span></div></div>
      <div className="detail-section"><h2>AI value check</h2><p>The API estimated this home from its location, area, BHK and bathroom count.</p><div className="value-compare"><div><span>AI estimated value</span><strong>{formatPrice(item.predicted_price_lakhs)}</strong><small>Model range is shown during valuation</small></div><div className="compare-status"><span>Asking price comparison</span><strong>{deal.badgeText}</strong><small>{Math.abs(Math.round(deal.differencePct))}% {deal.differencePct < 0 ? "below" : "above"} the estimate</small></div></div></div>
      <div className="detail-section"><h2>About this home</h2><p className="description">{item.bhk} bedroom home in {item.location}, Bengaluru, with {item.total_sqft.toLocaleString()} square feet of built-up area.</p><p className="detail-created">Listed {new Date(item.created_at.replace(" ", "T")).toLocaleDateString("en-IN")}</p></div></article>
    <aside className="contact-card"><span className="kicker">Interested in this home?</span><h2>Talk to the seller</h2><p>Contact the person who created this listing.</p><div className="seller-contact"><strong>{item.seller_name}</strong><a href={`tel:${item.seller_phone}`}>{item.seller_phone}</a></div><a className="btn btn-primary full-btn" href={`tel:${item.seller_phone}`}>Call seller <Icon name="arrow" size={17} /></a><small><Icon name="check" size={14} /> Shared listing stored with the app data service.</small></aside>
    </div></main>;
}

function Footer({ go }: { go: (page: Page) => void }) {
  return <footer><div className="footer-inner"><div className="footer-brand"><Logo onClick={() => go("home")} /><p>Smarter home decisions, built for Bengaluru.</p></div><div><strong>Explore</strong><button onClick={() => go("predict")}>Price predictor</button><button onClick={() => go("listings")}>Browse homes</button></div><div><strong>Sell</strong><button onClick={() => go("sell")}>List your home</button><button onClick={() => go("home")}>How it works</button></div><div><strong>API</strong><a href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/docs`} target="_blank" rel="noreferrer">API documentation</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Niva Homes · Bengaluru</span><span>Price estimates are informational</span></div></footer>;
}

export default function Home() {
  const [page, setPage] = useState<Page>("home"); const [locations, setLocations] = useState<string[]>([]); const [health, setHealth] = useState<HealthData | null>(null); const [locationError, setLocationError] = useState("");
  const [listings, setListings] = useState<HomeListing[]>([]); const [listingsReady, setListingsReady] = useState(false); const [listingError, setListingError] = useState(""); const [selectedListing, setSelectedListing] = useState<HomeListing | null>(null);
  useEffect(() => {
    fetchLocations().then(setLocations).catch((err: ApiError) => setLocationError(err.message ?? "Could not load locations from the API."));
    fetchHealth().then(setHealth).catch(() => setHealth(null));
    getStoredListings().then((items) => { setListings(items); setListingsReady(true); }).catch(() => { setListings(getOfflineListings()); setListingsReady(true); setListingError("Listing storage is unavailable. Showing sample and previously saved browser listings."); });
    const syncHash = () => { const target = window.location.hash.replace("#", ""); if (["home", "predict", "sell", "listings"].includes(target)) setPage(target as Page); };
    syncHash(); window.addEventListener("hashchange", syncHash); return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  const go = (next: Page) => { setPage(next); if (next !== "detail") window.history.pushState(null, "", `#${next}`); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openListing = (item: HomeListing) => { setSelectedListing(item); setPage("detail"); window.history.pushState(null, "", `#listing/${item.id}`); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const publishListing = (item: HomeListing) => { setListings((current) => [item, ...current.filter((existing) => existing.id !== item.id)]); setListingsReady(true); setListingError(""); setSelectedListing(item); go("listings"); };
  return <div className="app"><Navbar page={page} go={go} />
    {locationError && <div className="api-notice" role="status">Location service unavailable. Check the API connection, then reload to use live locality options.</div>}
    {listingError && <div className="api-notice" role="status">{listingError}</div>}
    {page === "home" && <HomePage go={go} locations={locations} health={health} listings={listings} onOpen={openListing} />}
    {page === "predict" && <PredictorPage go={go} locations={locations} />}
    {page === "sell" && <SellerPage locations={locations} onPublished={publishListing} />}
    {page === "listings" && <ListingsPage listings={listings} ready={listingsReady} onOpen={openListing} go={go} locations={locations} />}
    {page === "detail" && <DetailPage item={selectedListing} go={go} />}
    {(page === "home" || page === "detail") && <Footer go={go} />}
    <BottomNav page={page} go={go} />
  </div>;
}
