import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { username, isGuest, logout } = useAuth();
  const navigate = useNavigate();
  const [lightMode, setLightMode] = useState(() => localStorage.getItem("lightMode") === "true");

  useEffect(() => {
    document.body.classList.toggle("light-mode", lightMode);
    localStorage.setItem("lightMode", String(lightMode));
  }, [lightMode]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="sidebar">
      <NavLink to="/" className="sidebar-logo">Finance</NavLink>

      <nav className="sidebar-nav">
        <NavLink to="/"           end>Dashboard</NavLink>
        <NavLink to="/retirement">Retirement</NavLink>
        <NavLink to="/budget">Budget</NavLink>
        <NavLink to="/networth">Net Worth</NavLink>
        <NavLink to="/goals">Goals</NavLink>
        <NavLink to="/portfolio">Portfolio</NavLink>
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-username">{username ?? (isGuest ? "Guest" : "")}</span>
        <label className="dark-toggle">
          <input
            type="checkbox"
            checked={lightMode}
            onChange={(e) => setLightMode(e.target.checked)}
          />
          Light mode
        </label>
        <button className="btn-logout" onClick={handleLogout}>Logout</button>
      </div>
    </aside>
  );
}
