import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="global-footer">
      <div className="content-wrapper footer-content">
        <div className="footer-links-row">
          <Link to="/" className="footer-link">About</Link>
          <Link to="/explore" className="footer-link">Services</Link>
          <Link to="/explore?category=Programming" className="footer-link">Programming</Link>
          <Link to="/explore?category=Design" className="footer-link">Design</Link>
          <Link to="/explore?category=Video" className="footer-link">Video</Link>
          <a href="#terms" className="footer-link" onClick={(e) => e.preventDefault()}>Terms</a>
          <a href="#privacy" className="footer-link" onClick={(e) => e.preventDefault()}>Privacy</a>
        </div>
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} DUMMR Services. Own your expertise. Earn your value.
        </div>
      </div>
    </footer>
  );
}
