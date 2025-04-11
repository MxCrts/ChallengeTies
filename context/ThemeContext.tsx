import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void; // Plus besoin de Promise<void> sans AsyncStorage
}

interface ThemeProviderProps {
  children: ReactNode;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    console.log("🎨 ToggleTheme appelé, thème actuel :", theme);
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    console.log("🎨 Nouveau thème défini :", newTheme);
  };

  console.log("✅ ThemeProvider rendu avec theme :", theme);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
