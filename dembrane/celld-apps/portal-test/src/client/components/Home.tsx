import { Link } from "react-router";

// The project this page links to, to try the start page with.
const EXAMPLE_PROJECT_ID = "01a0f438-ac9f-773f-a492-3cda809863cf";

export function Home() {
  return (
    <p>
      Open a project's portal at <code>/&lt;language&gt;/&lt;project id&gt;/start</code>, such as{" "}
      <Link to={`/en-US/${EXAMPLE_PROJECT_ID}/start`}>this one</Link>.
    </p>
  );
}
