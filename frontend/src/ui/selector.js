export function renderSelector(spaces, onSelect, onRename, onDelete, onEdit) {
  const container = document.getElementById('selector');
  if (!container) return;

  container.innerHTML = '';

  spaces.forEach(space => {
    const item = document.createElement('div');
    item.className = 'selector-item';

    const btn = document.createElement('button');
    btn.className = 'selector-button';
    btn.innerText = (space.label || space.id).replace(/[-_]/g, ' ');
    btn.onclick = () => onSelect(space.id);
    item.appendChild(btn);

    const meta = document.createElement('div');
    meta.className = 'selector-meta';

    // 编辑按钮
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'selector-icon selector-edit';
    editButton.title = '编辑';
    editButton.innerText = '⚙️';
    editButton.onclick = event => {
      event.stopPropagation();
      onEdit?.(space.id);
    };
    meta.appendChild(editButton);

    const renameButton = document.createElement('button');
    renameButton.type = 'button';
    renameButton.className = 'selector-icon selector-rename';
    renameButton.title = '重命名';
    renameButton.innerText = '✎';
    renameButton.onclick = event => {
      event.stopPropagation();
      onRename?.(space.id);
    };
    meta.appendChild(renameButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'selector-icon selector-delete';
    deleteButton.title = '删除';
    deleteButton.innerText = '×';
    deleteButton.onclick = event => {
      event.stopPropagation();
      onDelete?.(space.id);
    };
    meta.appendChild(deleteButton);

    item.appendChild(meta);
    container.appendChild(item);
  });
}