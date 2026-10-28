export function ResultsSkeleton() {
  return (
    <div role="status" aria-label="Loading issues">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="skeleton-row" />
      ))}
    </div>
  );
}
