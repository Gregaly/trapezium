import { mount } from "svelte"

import App from "./App.svelte"
import "@trapezium/svelte/styles.css"
import "./app.css"

mount(App, { target: document.querySelector("#app")! })
