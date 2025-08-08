const STORAGE_KEY = 'dqt_enabled';

function sendMessage(msg){
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(msg, (res) => resolve(res));
        } catch {
            resolve(undefined);
        }
    });
}

function setStatus(el, enabled){
    el.textContent = enabled ? 'ON' : 'OFF';
    el.classList.toggle('on', enabled);
    el.classList.toggle('off', !enabled);
}

window.addEventListener('load', async function (){
    const toggle = document.getElementById('toggle');
    const status = document.getElementById('status');
    // Load current state
    const res = await sendMessage({ type: 'DQT_GET_ENABLED' });
    const enabled = !!(res?.enabled ?? true);
    toggle.checked = enabled;
    setStatus(status, enabled);

    toggle.addEventListener('change', async (e) => {
        const next = !!e.target.checked;
        await sendMessage({ type: 'DQT_SET_ENABLED', enabled: next });
        setStatus(status, next);
    });
});