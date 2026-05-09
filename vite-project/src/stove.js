document.querySelector('#instructions').addEventListener('click', async () => {
  const mod = await import('/src/stoveInstructions.js');
  mod.run();
});

document.querySelector('#demo').addEventListener('click', async () => {
  const mod = await import('/src/stoveDemo.js');
  mod.run();
});