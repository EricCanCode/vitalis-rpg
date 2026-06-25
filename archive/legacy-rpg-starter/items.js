// Item definitions and inventory logic for RPG Starter

const ITEMS = [
  { id: 1, name: "Sword", type: "weapon", atk: 3 },
  { id: 2, name: "Shield", type: "armor", def: 2 },
  { id: 3, name: "Potion", type: "consumable", heal: 10 },
];

function addItemToInventory(itemId) {
  const item = ITEMS.find(i => i.id === itemId);
  if (item) {
    player.inventory.push(item.name);
    updateUI();
    showDialogue(`Picked up: ${item.name}`);
  }
}

function equipItem(itemName) {
  const item = ITEMS.find(i => i.name === itemName);
  if (!item) return;
  if (item.type === "weapon" || item.type === "armor") {
    player.equipment[item.type] = item.name;
    showDialogue(`Equipped: ${item.name}`);
    updateUI();
  }
}

function useItem(itemName) {
  const idx = player.inventory.indexOf(itemName);
  if (idx === -1) return;
  const item = ITEMS.find(i => i.name === itemName);
  if (item && item.type === "consumable") {
    player.hp = Math.min(player.maxHp, player.hp + item.heal);
    player.inventory.splice(idx, 1);
    showDialogue(`Used: ${item.name}`);
    updateUI();
  }
}

function showDialogue(text) {
  document.getElementById('dialoguePanel').innerHTML = text;
}
