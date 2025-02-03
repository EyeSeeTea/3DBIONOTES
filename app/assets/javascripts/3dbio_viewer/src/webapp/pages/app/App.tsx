import React from "react";
import { HashRouter } from "react-router-dom";
import { AppContext } from "../../../webapp/components/AppContext";
import { ThemeProvider, createTheme } from "@material-ui/core/styles";
import AppRouter from "./AppRouter";
import "./App.css";

const theme = createTheme();

function App() {
    return (
        <ThemeProvider theme={theme}>
            <AppContext>
                <HashRouter>
                    <AppRouter />
                </HashRouter>
            </AppContext>
        </ThemeProvider>
    );
}

export default React.memo(App);
