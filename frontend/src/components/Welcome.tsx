import {
  ArrowRight,
  CheckCircle,
  Leaf,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
export function Welcome() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> YOUR NEIGHBOURHOOD. YOUR ADVANTAGE.
          </div>
          <h1>
            Good groceries.
            <br />
            Great neighbours.
            <br />
            <em>Better prices.</em>
          </h1>
          <p>
            Your everyday essentials, bought together with your society. Join
            the collective and make every grocery run go further.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/shop">
              Explore the collective <ArrowRight size={18} />
            </Link>
            <Link className="text-link" to="/register">
              Join your neighbours ↗
            </Link>
          </div>
          <div className="hero-note">
            <ShieldCheck size={18} /> Transparent prices. Community-powered
            savings.
          </div>
        </div>
        <div className="hero-art">
          <div className="orbit one" />
          <div className="orbit two" />
          <div className="fresh-tag">
            <Leaf size={17} /> EVERYDAY ESSENTIALS, REIMAGINED
          </div>
          <div className="grocery-scene">
            <span className="rice-bag">
              🌾
              <b>
                THE PANTRY
                <br />
                COLLECTIVE
              </b>
              <small>BASMATI RICE · 5 kg</small>
            </span>
            <span className="oil-bottle">🫙</span>
            <span className="veg">🥬</span>
            <span className="tomatoes">🍅</span>
          </div>
          <div className="floating-card">
            <div className="avatars">👩🏽 👨🏽 👩🏻</div>
            <div>
              <b>Better together</b>
              <small>One society. One shared basket.</small>
            </div>
            <CheckCircle size={24} color="#16a34a" />
          </div>
        </div>
      </section>
      <section className="benefits">
        <div>
          <Users />
          <span>
            <b>Your society, one collective</b>
            <small>Buy with the people around you</small>
          </span>
        </div>
        <div>
          <Leaf />
          <span>
            <b>Everyday essentials</b>
            <small>A thoughtfully selected pantry</small>
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <b>Savings you can see</b>
            <small>Clear prices, no guesswork</small>
          </span>
        </div>
      </section>
      <section className="section-heading">
        <div className="eyebrow">A SMARTER WAY TO STOCK UP</div>
        <h2>Small steps. Shared savings.</h2>
        <p>From your shopping list to your society’s doorstep.</p>
      </section>
      <div className="steps">
        {[
          [
            "01",
            "Find your community",
            "Choose your society and get your membership approved.",
          ],
          [
            "02",
            "Build your basket",
            "Shop essentials at your active collective’s group prices.",
          ],
          [
            "03",
            "Let’s buy together",
            "Once the group goal is met, we bring your orders together.",
          ],
        ].map(([n, t, d]) => (
          <article key={n}>
            <span>{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
      </div>
      <section className="cta">
        <div>
          <h2>
            Your next grocery run
            <br />
            starts with your neighbours.
          </h2>
          <p>More connection. More value. One shared cart.</p>
        </div>
        <Link className="button" to="/register">
          Find my society <ArrowRight size={18} />
        </Link>
      </section>
    </>
  );
}
