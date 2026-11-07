import { render, screen } from '@testing-library/react';
import App from './App';

test('renders dummr marketplace elements', () => {
  render(<App />);
  expect(screen.getAllByText(/dummr/i).length).toBeGreaterThan(0);
});
