type Dictionary<T> = Record<string, T>;

type Color =
    | "primary"
    | "secondary"
    | "default"
    | "inherit"
    | "error"
    | "success"
    | "info"
    | "warning";
type ColorPalette = "main" | "light" | "dark";

const theme: Dictionary<Dictionary<string>> = {
    main: {
        primary: "#fff",
        secondary: "#93d2f1",
    },
    light: {
        primary: "#7efffe",
        secondary: "#ffc046",
    },
    dark: {
        primary: "#93d2f1",
        secondary: "#fff",
    },
    // Temporal patch just to make @mui work
    inherit: {
        primary: "inherit",
        secondary: "inherit",
    },
    error: {
        primary: "#f44336",
        secondary: "#e57373",
    },
    success: {
        primary: "#4caf50",
        secondary: "#81c784",
    },
    info: {
        primary: "#2196f3",
        secondary: "#64b5f6",
    },
    warning: {
        primary: "#ff9800",
        secondary: "#ffb74d",
    },
};

export const getColor = (color: Color, palette: ColorPalette = "main") => {
    return theme[palette]?.[color] ?? theme.main?.primary;
};
