export default function TeamsListPage() {
  return (
    <div>
      <h1 className="font-heading text-[28px] font-semibold text-black">
        Teams
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <p className="col-span-full text-center font-body text-base text-text-secondary">
          No teams yet
        </p>
      </div>
    </div>
  );
}
