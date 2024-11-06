import "./style.css";

const app: HTMLDivElement = document.querySelector("#app")!;
const button = document.createElement("button");
button.innerHTML = "Click here";
button.addEventListener("click", () => displayMessage());
app.append(button);

function displayMessage() {
  const message = document.createElement("p");
  message.innerHTML = "alert! (you clicked the button)";
  app.append(message);
}
