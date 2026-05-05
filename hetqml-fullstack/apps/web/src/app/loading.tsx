export default function RootLoading() {
  return (
    <main
      className="main"
      aria-busy="true"
      style={{ padding: 32, opacity: 0.7 }}
    >
      <div
        style={{
          height: 18,
          width: 220,
          background: "var(--border-soft)",
          borderRadius: 4,
        }}
      />
    </main>
  );
}
