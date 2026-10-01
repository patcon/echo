export const ErrorText = ({
  path,
  result,
}: {
  path: string;
  result: { status: number; body: unknown };
}) => (
  <span className="error">
    GET {path}: HTTP {result.status} {JSON.stringify(result.body)}
  </span>
);
