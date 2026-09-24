// Progressive enhancement: commands remain readable if Clipboard API is unavailable.
const copyStatus = document.getElementById('copy-status');
const copyTimers = new WeakMap();
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const code = document.getElementById(button.dataset.copy);
    if (!code) return;
    clearTimeout(copyTimers.get(button));
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = 'Скопировано ✓';
      copyStatus.textContent = 'Команды скопированы. Замените значения из примера своими перед выполнением.';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = 'Текст выделен';
      copyStatus.textContent = 'Копирование недоступно. Команды выделены: скопируйте их сочетанием Ctrl+C или Command+C.';
    }
    copyTimers.set(button, setTimeout(() => { button.textContent = 'Копировать'; }, 2500));
  });
}
