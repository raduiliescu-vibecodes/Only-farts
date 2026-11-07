import Link from "next/link";

export default function NotFound() {
  return (
    <section className="intro">
      <h1>Nothing to smell here</h1>
      <p className="lede">That page doesn&apos;t exist. Only four characters are tracked.</p>
      <p>
        <Link href="/" className="button">
          Back to the dashboard
        </Link>
      </p>
    </section>
  );
}
