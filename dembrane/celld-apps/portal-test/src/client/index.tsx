import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Home } from "./components/Home";
import { NotFound } from "./components/NotFound";
import { Start } from "./components/Start";

// The portal's routes, as in frontend/src/Router.tsx's participantRouter: an
// optional language, then the project. Only `start` is here.
const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  {
    path: "/:language?/:projectId",
    children: [
      { index: true, element: <Navigate to="start" replace /> },
      { path: "start", element: <Start /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const root = document.getElementById("root");
if (root) createRoot(root).render(<RouterProvider router={router} />);
