// Add a comment hint for webstorm to style the string as css
export default `

body {
    margin: 0;
    padding: 0;
    background: #1e1e1e;
}
body * {
    box-sizing: border-box;
}

#terminal {
    margin: 40px;
    background: black;
    border: 1px solid #dedede;
    border-radius: 5px;
    overflow: hidden;
}

#terminal .xterm {
    margin: 10px;
    height: calc(100vh - 120px);
    border-radius: 5px;
}

#terminal .xterm-viewport::-webkit-scrollbar {
    width: 0.4em;
    background-color: #222;
}

#terminal .xterm-viewport::-webkit-scrollbar-thumb {
    background-color: #555;
}

#terminal .window-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background-color: #f1f1f1;
    padding: 10px;
}

#terminal .window-header button {
    background-color: transparent;
    border: none;
    font-size: 14px;
    font-weight: bold;
    color: #444;
    cursor: pointer;
    margin-left: 10px;
}

.minimize-button {
    content: "-";
}

.maximize-button {
    content: "+";
}

.close-button {
    content: "x";
}

`;
