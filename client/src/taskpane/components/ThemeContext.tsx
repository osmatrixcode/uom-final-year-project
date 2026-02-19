import * as React from "react";
import { createContext, useContext, useState } from "react";

interface ThemeContextValue {
  isDark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: false, toggleDark: () => {} });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const toggleDark = () => setIsDark((prev) => !prev);

  return <ThemeContext.Provider value={{ isDark, toggleDark }}>{children}</ThemeContext.Provider>;
};
