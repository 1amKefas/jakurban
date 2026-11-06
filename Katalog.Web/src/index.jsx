/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import App from './App.jsx';

/**
 * Entry point utama aplikasi Front-End JakUrban (Solid.JS).
 * Merender komponen reaktif <App /> secara langsung ke DOM asli (#root) tanpa Virtual DOM.
 */
const root = document.getElementById('root');

render(() => <App />, root);