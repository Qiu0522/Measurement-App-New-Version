"use strict";

const App = (() => {
  const ROOM_COLORS = ["#0066ff", "#ff0000", "#00aa00", "#8000ff", "#e07b00", "#00969c", "#c2185b", "#5d4037"];
  const MEASUREMENT_PATTERN = /^-?(\d+(\s\d+\/[1-9]\d*)?|\d+\/[1-9]\d*)$/;

  const els = {};

  /* ---------- State ---------- */

  let project = null;
  let pdfDocument = null;
  let pdfRendering = false;
  let currentSide = "";
  let pendingAddPointCoords = null; // {x, y} while adding a brand-new point
  let editingPoint = null;          // the point object being edited, else null
  let measurementRawValue = "";
  let contextPoint = null;
  let dirty = false;
  let autoSaveTimer = null;
  let pendingDeleteRoomId = null;
  let roomModalFromManage = false;

  function uid(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function clone(value) {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
  }

  function emptyProject() {
    const roomId = uid("room");
    return {
      kind: "blank",
      fileData: null,
      rooms: [{ id: roomId, name: "Room 1", color: ROOM_COLORS[0], sideTags: [], lastSelectedSide: "", direction: "clockwise", lockedSides: [] }],
      points: [],
      currentRoomId: roomId,
      zoom: 1,
      showOrderLabels: false
    };
  }

  function currentRoom() {
    return getRoom(project.currentRoomId) || project.rooms[0];
  }

  function getRoom(id) {
    return project.rooms.find(r => r.id === id);
  }

  function pointsInSide(roomId, side) {
    return project.points.filter(p => p.roomId === roomId && p.side === side);
  }

  function seqOf(point) {
    const siblings = pointsInSide(point.roomId, point.side).slice().sort((a, b) => a.order - b.order);
    return siblings.findIndex(p => p.id === point.id) + 1;
  }

  function labelFor(point) {
    const room = getRoom(point.roomId);
    return `${room ? room.name : "?"}-${point.side}-${seqOf(point)}`;
  }

  /* ---------- Element cache ---------- */

  function cacheElements() {
    [
      "newProjectBtn", "importPdfBtn", "importImageBtn", "pdfFileInput", "imageFileInput",
      "roomPickerBtn", "roomSwatch", "roomPickerLabel", "labelsBtn", "autoSortBtn", "exportCsvBtn",
      "zoomOutBtn", "zoomDisplay", "zoomInBtn", "fitBtn", "statusText",
      "drawingWrapper", "drawingArea", "pdfCanvasHolder", "imageBackdrop", "pointsLayer", "emptyState",
      "measurementModal", "measurementTitle", "measurementDisplay", "measurementError",
      "missingValueBtn", "flexibleSideRow", "cancelMeasurementBtn",
      "pointContextMenu", "pointEditAction", "pointExcludeAction", "pointDeleteAction",
      "roomPickerModal", "roomPickerList", "manageRoomsFromPickerBtn", "cancelRoomPickerBtn",
      "manageRoomsModal", "manageRoomsList", "addRoomFromManageBtn", "closeManageRoomsBtn",
      "roomModal", "roomNameInput", "roomColorInput", "inheritSidesHint", "cancelRoomBtn", "confirmRoomBtn",
      "reassignRoomModal", "reassignRoomTitle", "reassignRoomHint", "reassignRoomList",
      "deleteRoomPermanentlyBtn", "cancelReassignRoomBtn",
      "sideNameModal", "sideNameInput", "cancelSideNameBtn", "confirmSideNameBtn",
      "autoSortModal", "autoSortRoom", "autoSortSidesList", "confirmAutoSortBtn", "cancelAutoSortBtn",
      "positionDirectionField", "angleDirectionField",
      "fileNameModal", "fileNameModalTitle", "fileNameInput", "confirmFileNameBtn", "cancelFileNameBtn"
    ].forEach(id => { els[id] = document.getElementById(id); });

    els.autoSortMethodChoices = Array.from(document.querySelectorAll('input[name="autoSortMethod"]'));
    els.autoSortPosDirChoices = Array.from(document.querySelectorAll('input[name="posDir"]'));
    els.autoSortAngleDirChoices = Array.from(document.querySelectorAll('input[name="angleDir"]'));
  }

  /* ---------- Init / persistence ---------- */

  async function init() {
    cacheElements();
    bindEvents();

    let saved = null;
    try {
      saved = await ProjectDB.load();
    } catch (e) {
      console.error("Could not load saved project:", e);
    }

    project = saved || emptyProject();
    if (!project.rooms || !project.rooms.length) {
      const fresh = emptyProject();
      project.rooms = fresh.rooms;
      project.currentRoomId = fresh.currentRoomId;
    }
    if (!getRoom(project.currentRoomId)) project.currentRoomId = project.rooms[0].id;
    if (typeof project.zoom !== "number") project.zoom = 1;

    if (project.kind === "pdf" && project.fileData) {
      try {
        await renderPdf(project.fileData);
      } catch (e) {
        console.error("Could not render saved PDF:", e);
        setStatus("Could not reopen the saved PDF — starting from a blank canvas.");
        project.kind = "blank";
        project.fileData = null;
      }
    } else if (project.kind === "image" && project.fileData) {
      renderImage(project.fileData);
    }

    applyZoom();
    updateEmptyState();
    renderRoomPickerLabel();
    renderAllPoints();
    setStatus("Ready.");

    window.addEventListener("beforeunload", () => { if (dirty) flushSave(); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && dirty) flushSave();
    });
    window.addEventListener("pagehide", () => { if (dirty) flushSave(); });
    setInterval(() => { if (dirty) flushSave(); }, 3 * 60 * 1000);
  }

  function scheduleAutoSave() {
    dirty = true;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(flushSave, 1200);
  }

  async function flushSave() {
    if (!project) return;
    dirty = false;
    try {
      await ProjectDB.save(project);
    } catch (e) {
      console.error("Autosave failed:", e);
      setStatus("Autosave failed: " + ProjectDB.explainError(e));
      dirty = true;
    }
  }

  function setStatus(text) {
    if (els.statusText) els.statusText.textContent = text || "";
  }

  /* ---------- New project ---------- */

  async function startNewProject() {
    if (!confirm("Start a new project? This clears the current drawing, rooms, and points from this device. Export any CSV you need first.")) {
      return;
    }

    pdfDocument = null;
    pendingAddPointCoords = null;
    editingPoint = null;
    contextPoint = null;
    pendingDeleteRoomId = null;
    roomModalFromManage = false;
    currentSide = "";
    project = emptyProject();
    els.pdfCanvasHolder.innerHTML = "";
    els.imageBackdrop.src = "";
    els.imageBackdrop.classList.add("hidden");
    els.drawingArea.style.width = "";
    els.drawingArea.style.height = "";
    applyZoom();
    updateEmptyState();
    renderRoomPickerLabel();
    renderAllPoints();
    setStatus("New project started.");
    await ProjectDB.save(project);
  }

  /* ---------- PDF import / render ---------- */

  async function handlePdfFile(file) {
    const buffer = await file.arrayBuffer();
    pdfDocument = null;
    try {
      await renderPdf(buffer);
    } catch (e) {
      console.error(e);
      alert("Could not open this PDF.\n\n" + ProjectDB.explainError(e) +
        "\n\nIt may be password-protected, corrupted, or too large for this device.");
      return;
    }

    project.kind = "pdf";
    project.fileData = buffer;
    updateEmptyState();
    scheduleAutoSave();
  }

  async function renderPdf(arrayBuffer) {
    els.imageBackdrop.classList.add("hidden");
    pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    const page = await pdfDocument.getPage(1);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");

    if (pdfRendering) return;
    pdfRendering = true;
    try {
      await page.render({ canvasContext: ctx, viewport }).promise;
    } finally {
      pdfRendering = false;
    }

    els.pdfCanvasHolder.innerHTML = "";
    els.pdfCanvasHolder.appendChild(canvas);
    els.drawingArea.style.width = viewport.width + "px";
    els.drawingArea.style.height = viewport.height + "px";
  }

  /* ---------- Image import / render ---------- */

  function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      project.kind = "image";
      project.fileData = reader.result;
      renderImage(reader.result);
      updateEmptyState();
      scheduleAutoSave();
    };
    reader.readAsDataURL(file);
  }

  function renderImage(src) {
    els.pdfCanvasHolder.innerHTML = "";
    els.imageBackdrop.src = src;
    els.imageBackdrop.classList.remove("hidden");
    els.imageBackdrop.onload = () => {
      els.drawingArea.style.width = els.imageBackdrop.naturalWidth + "px";
      els.drawingArea.style.height = els.imageBackdrop.naturalHeight + "px";
    };
  }

  function updateEmptyState() {
    const hasContent = project.kind === "pdf" || project.kind === "image" || project.points.length > 0;
    els.emptyState.classList.toggle("hidden", hasContent);
  }

  /* ---------- Zoom / fit ---------- */

  function applyZoom() {
    els.drawingArea.style.transform = `scale(${project.zoom})`;
    els.drawingArea.style.transformOrigin = "0 0";
    els.zoomDisplay.textContent = Math.round(project.zoom * 100) + "%";
  }

  function changeZoom(delta) {
    project.zoom = Math.min(4, Math.max(0.25, Math.round((project.zoom + delta) * 100) / 100));
    applyZoom();
    scheduleAutoSave();
  }

  function fitToScreen() {
    const contentWidth = parseFloat(els.drawingArea.style.width) || els.drawingWrapper.clientWidth;
    const contentHeight = parseFloat(els.drawingArea.style.height) || els.drawingWrapper.clientHeight;
    if (!contentWidth || !contentHeight) return;

    const scaleX = (els.drawingWrapper.clientWidth - 24) / contentWidth;
    const scaleY = (els.drawingWrapper.clientHeight - 24) / contentHeight;
    project.zoom = Math.min(4, Math.max(0.1, Math.min(scaleX, scaleY)));
    applyZoom();
    scheduleAutoSave();
  }

  /* ---------- Room picker ---------- */

  function renderRoomPickerLabel() {
    const room = currentRoom();
    els.roomSwatch.style.background = room ? room.color : "transparent";
    els.roomPickerLabel.textContent = room ? room.name : "Room";
  }

  function openRoomPicker() {
    renderRoomPickerList();
    els.roomPickerModal.classList.remove("hidden");
  }

  function renderRoomPickerList() {
    els.roomPickerList.innerHTML = "";
    const currentId = project.currentRoomId;

    project.rooms.forEach(room => {
      const pointCount = project.points.filter(p => p.roomId === room.id).length;

      const row = document.createElement("button");
      row.type = "button";
      row.className = "roomPickerRow" + (room.id === currentId ? " activeRoom" : "");

      const swatch = document.createElement("span");
      swatch.className = "roomRowSwatch";
      swatch.style.background = room.color;

      const name = document.createElement("span");
      name.className = "roomRowName";
      name.textContent = room.name;

      const count = document.createElement("span");
      count.className = "roomRowCount";
      count.textContent = pointCount === 1 ? "1 point" : `${pointCount} points`;

      row.appendChild(swatch);
      row.appendChild(name);
      row.appendChild(count);

      row.addEventListener("click", () => {
        project.currentRoomId = room.id;
        currentSide = room.lastSelectedSide || "";
        renderRoomPickerLabel();
        els.roomPickerModal.classList.add("hidden");
        scheduleAutoSave();
      });

      els.roomPickerList.appendChild(row);
    });
  }

  /* ---------- Manage rooms ---------- */

  function openManageRoomsModal() {
    renderManageRoomsList();
    els.manageRoomsModal.classList.remove("hidden");
  }

  function renderManageRoomsList() {
    els.manageRoomsList.innerHTML = "";

    project.rooms.forEach(room => {
      const pointCount = project.points.filter(p => p.roomId === room.id).length;

      const row = document.createElement("div");
      row.className = "manageRoomRow";

      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = room.color || "#000000";
      colorInput.addEventListener("input", () => {
        room.color = colorInput.value;
        renderRoomPickerLabel();
        renderAllPoints();
        scheduleAutoSave();
      });

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = room.name;
      nameInput.addEventListener("change", () => {
        const trimmed = nameInput.value.trim();
        if (!trimmed) { nameInput.value = room.name; return; }
        room.name = trimmed;
        renderRoomPickerLabel();
        renderAllPoints();
        scheduleAutoSave();
      });

      const countLabel = document.createElement("span");
      countLabel.className = "manageRoomCount";
      countLabel.textContent = pointCount === 1 ? "1 point" : `${pointCount} points`;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "manageRoomDeleteBtn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => deleteRoom(room.id));

      row.appendChild(colorInput);
      row.appendChild(nameInput);
      row.appendChild(countLabel);
      row.appendChild(deleteBtn);
      els.manageRoomsList.appendChild(row);
    });
  }

  /* ---------- Add room ---------- */

  function openAddRoomModal() {
    const previous = currentRoom();
    els.roomNameInput.value = "New Room";
    els.roomColorInput.value = ROOM_COLORS[project.rooms.length % ROOM_COLORS.length];
    els.inheritSidesHint.textContent = previous && previous.sideTags.length
      ? `This will start with the same sides as "${previous.name}" (${previous.sideTags.join(", ")}) — remove any that don't apply.`
      : "";
    els.manageRoomsModal.classList.add("hidden");
    els.roomModal.classList.remove("hidden");
  }

  function confirmAddRoom() {
    const name = els.roomNameInput.value.trim();
    if (!name) { alert("Enter a room name."); return; }

    const previous = currentRoom();
    const id = uid("room");
    const room = {
      id, name,
      color: els.roomColorInput.value || "#000000",
      sideTags: previous ? previous.sideTags.slice() : [],
      lastSelectedSide: previous ? (previous.lastSelectedSide || "") : "",
      direction: "clockwise",
      lockedSides: []
    };

    project.rooms.push(room);
    project.currentRoomId = id;
    currentSide = room.lastSelectedSide;

    els.roomModal.classList.add("hidden");
    renderRoomPickerLabel();
    scheduleAutoSave();

    if (pendingDeleteRoomId) {
      const sourceId = pendingDeleteRoomId;
      pendingDeleteRoomId = null;
      reassignPointsAndDeleteRoom(sourceId, id);
      renderManageRoomsList();
      els.manageRoomsModal.classList.remove("hidden");
      return;
    }

    if (roomModalFromManage) {
      roomModalFromManage = false;
      renderManageRoomsList();
      els.manageRoomsModal.classList.remove("hidden");
    }
  }

  /* ---------- Delete room (with reassign-before-delete) ---------- */

  function deleteRoom(roomId) {
    if (project.rooms.length <= 1) {
      alert("You need at least one room — add a new one before deleting this one.");
      return;
    }

    const room = getRoom(roomId);
    if (!room) return;

    const affected = project.points.filter(p => p.roomId === roomId);

    if (!affected.length) {
      if (!confirm(`Delete the room "${room.name}"? It has no points, so nothing else will be affected.`)) return;
      deleteRoomAndPoints(roomId);
      renderManageRoomsList();
      return;
    }

    openReassignRoomModal(roomId);
  }

  function openReassignRoomModal(roomId) {
    const room = getRoom(roomId);
    if (!room) return;

    pendingDeleteRoomId = roomId;
    const count = project.points.filter(p => p.roomId === roomId).length;

    els.reassignRoomTitle.textContent = `Move ${count} point(s) out of "${room.name}"?`;
    els.reassignRoomHint.textContent =
      `"${room.name}" has ${count} point(s). Pick another room to move them to before deleting this one, or delete everything permanently below.`;

    renderReassignRoomList(roomId);
    els.manageRoomsModal.classList.add("hidden");
    els.reassignRoomModal.classList.remove("hidden");
  }

  function renderReassignRoomList(sourceId) {
    els.reassignRoomList.innerHTML = "";

    project.rooms.filter(r => r.id !== sourceId).forEach(room => {
      const count = project.points.filter(p => p.roomId === room.id).length;

      const row = document.createElement("button");
      row.type = "button";
      row.className = "roomPickerRow";

      const swatch = document.createElement("span");
      swatch.className = "roomRowSwatch";
      swatch.style.background = room.color;

      const name = document.createElement("span");
      name.className = "roomRowName";
      name.textContent = `Move to "${room.name}"`;

      const countLabel = document.createElement("span");
      countLabel.className = "roomRowCount";
      countLabel.textContent = count === 1 ? "1 point" : `${count} points`;

      row.appendChild(swatch);
      row.appendChild(name);
      row.appendChild(countLabel);

      row.addEventListener("click", () => {
        reassignPointsAndDeleteRoom(sourceId, room.id);
        pendingDeleteRoomId = null;
        els.reassignRoomModal.classList.add("hidden");
        renderManageRoomsList();
        els.manageRoomsModal.classList.remove("hidden");
      });

      els.reassignRoomList.appendChild(row);
    });

    const createRow = document.createElement("button");
    createRow.type = "button";
    createRow.className = "roomPickerRow createNewRow";
    createRow.textContent = "+ Create New Room";
    createRow.addEventListener("click", () => {
      els.reassignRoomModal.classList.add("hidden");
      openAddRoomModal();
    });
    els.reassignRoomList.appendChild(createRow);
  }

  function reassignPointsAndDeleteRoom(sourceId, destinationId) {
    project.points.forEach(point => {
      if (point.roomId === sourceId) {
        // Points keep their side name, but that side may not exist on the
        // destination room yet — carry it over so labels/order stay sane.
        const destRoom = getRoom(destinationId);
        if (destRoom && point.side && !destRoom.sideTags.includes(point.side)) {
          destRoom.sideTags.push(point.side);
        }
        point.roomId = destinationId;
      }
    });
    project.rooms = project.rooms.filter(r => r.id !== sourceId);

    if (project.currentRoomId === sourceId) {
      project.currentRoomId = destinationId;
      currentSide = getRoom(destinationId).lastSelectedSide || "";
    }

    renderRoomPickerLabel();
    renderAllPoints();
    scheduleAutoSave();
    setStatus(`Points moved to "${getRoom(destinationId)?.name || "the new room"}".`);
  }

  function deleteRoomAndPoints(roomId) {
    project.points = project.points.filter(p => p.roomId !== roomId);
    project.rooms = project.rooms.filter(r => r.id !== roomId);

    if (project.currentRoomId === roomId) {
      project.currentRoomId = project.rooms[0].id;
      currentSide = project.rooms[0].lastSelectedSide || "";
    }

    renderRoomPickerLabel();
    renderAllPoints();
    scheduleAutoSave();
  }

  /* ---------- Side tag panel (inside measurement modal) ---------- */

  function renderSideRow() {
    const row = els.flexibleSideRow;
    row.innerHTML = "";

    const room = currentRoom();
    if (!room) return;

    room.sideTags.forEach(side => {
      const tag = document.createElement("button");
      tag.type = "button";
      tag.className = "sideTag" + (side === currentSide ? " activeSide" : "");

      const label = document.createElement("span");
      label.textContent = side;
      tag.appendChild(label);

      const removeBtn = document.createElement("span");
      removeBtn.className = "sideTagRemove";
      removeBtn.textContent = "×";
      removeBtn.title = "Delete this side";
      removeBtn.addEventListener("click", event => {
        event.stopPropagation();
        removeSideTag(side);
      });
      tag.appendChild(removeBtn);

      tag.addEventListener("click", () => {
        currentSide = side;
        room.lastSelectedSide = side;
        renderSideRow();
        clearMeasurementError();
        scheduleAutoSave();
      });

      row.appendChild(tag);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "sideTagAdd";
    addBtn.textContent = "+ 新的面";
    addBtn.addEventListener("click", () => {
      els.sideNameInput.value = "";
      els.sideNameModal.classList.remove("hidden");
      els.sideNameInput.focus();
    });
    row.appendChild(addBtn);
  }

  function confirmAddSideTag() {
    const name = els.sideNameInput.value.trim();
    if (!name) return;

    const room = currentRoom();
    if (!room.sideTags.includes(name)) room.sideTags.push(name);
    room.lastSelectedSide = name;
    currentSide = name;

    els.sideNameModal.classList.add("hidden");
    renderSideRow();
    clearMeasurementError();
    scheduleAutoSave();
  }

  function removeSideTag(side) {
    const room = currentRoom();
    const count = pointsInSide(room.id, side).length;

    const message = count
      ? `"${side}" 这个面在 "${room.name}" 里有 ${count} 个点。删除这个面会把这 ${count} 个点也一起永久删除，这个操作不能撤销。确定删除吗？`
      : `删除 "${side}" 这个面？（这个房间里这一面还没有点）`;

    if (!confirm(message)) return;

    project.points = project.points.filter(p => !(p.roomId === room.id && p.side === side));
    room.sideTags = room.sideTags.filter(s => s !== side);
    if (room.lastSelectedSide === side) room.lastSelectedSide = "";
    if (currentSide === side) currentSide = "";

    renderSideRow();
    renderAllPoints();
    scheduleAutoSave();
  }

  /* ---------- Measurement keypad ---------- */

  function openMeasurementModalForNew(x, y) {
    pendingAddPointCoords = { x, y };
    editingPoint = null;
    const room = currentRoom();
    currentSide = room.lastSelectedSide || "";
    measurementRawValue = "";
    els.measurementTitle.textContent = "Enter Measurement";
    renderSideRow();
    updateMeasurementDisplay();
    clearMeasurementError();
    els.measurementModal.classList.remove("hidden");
  }

  function openMeasurementModalForEdit(point) {
    pendingAddPointCoords = null;
    editingPoint = point;
    // Points from every room render together on the same canvas, so editing
    // one must switch context to ITS room — otherwise the side panel and
    // order math below would reference whatever room happened to be active.
    project.currentRoomId = point.roomId;
    currentSide = point.side || "";
    measurementRawValue = point.value || "";
    els.measurementTitle.textContent = "Edit Measurement";
    renderRoomPickerLabel();
    renderSideRow();
    updateMeasurementDisplay();
    clearMeasurementError();
    els.measurementModal.classList.remove("hidden");
  }

  function closeMeasurementModal() {
    els.measurementModal.classList.add("hidden");
    pendingAddPointCoords = null;
    editingPoint = null;
  }

  function updateMeasurementDisplay() {
    els.measurementDisplay.value = measurementRawValue.replace(/ /g, "_");
  }

  function setMeasurementRawValue(value) {
    measurementRawValue = String(value || "");
    updateMeasurementDisplay();
  }

  function clearMeasurementError() {
    els.measurementError.classList.add("hidden");
    els.measurementError.textContent = "";
  }

  function showMeasurementError(text) {
    els.measurementError.textContent = text;
    els.measurementError.classList.remove("hidden");
  }

  function appendMeasurementValue(value) {
    if (value === "X") { setMeasurementRawValue("X"); return; }
    if (measurementRawValue.toUpperCase() === "X") { setMeasurementRawValue(""); }
    setMeasurementRawValue(measurementRawValue + value);
  }

  function appendMeasurementFraction(fraction) {
    const selectedFraction = String(fraction || "").trim();
    if (!/^\d+\/\d+$/.test(selectedFraction)) return;

    let current = measurementRawValue.toUpperCase() === "X" ? "" : String(measurementRawValue || "").trim();

    if (!current) { setMeasurementRawValue(selectedFraction); return; }
    if (current === "-") { setMeasurementRawValue("-" + selectedFraction); return; }
    if (/^-?\d+$/.test(current)) { setMeasurementRawValue(current + " " + selectedFraction); return; }
    if (/^-?\d+\s+\d+\/\d+$/.test(current)) { setMeasurementRawValue(current.replace(/\d+\/\d+$/, selectedFraction)); return; }
    if (/^-?\d+\/\d+$/.test(current)) {
      setMeasurementRawValue(current.startsWith("-") ? "-" + selectedFraction : selectedFraction);
      return;
    }
    setMeasurementRawValue(current + " " + selectedFraction);
  }

  function measurementBackspace() {
    if (measurementRawValue.toUpperCase() === "X") { setMeasurementRawValue(""); return; }
    setMeasurementRawValue(measurementRawValue.slice(0, -1));
  }

  function clearMeasurement() { setMeasurementRawValue(""); }

  function toggleMeasurementNegative() {
    if (measurementRawValue.startsWith("-")) {
      setMeasurementRawValue(measurementRawValue.slice(1));
    } else if (measurementRawValue && measurementRawValue.toUpperCase() !== "X") {
      setMeasurementRawValue("-" + measurementRawValue);
    }
  }

  function confirmMeasurement() {
    const value = measurementRawValue.trim();

    if (!value) { showMeasurementError("Enter a measurement, or tap X for missing."); return; }
    if (value.toUpperCase() !== "X" && !MEASUREMENT_PATTERN.test(value)) {
      showMeasurementError("That doesn't look like a valid measurement.");
      return;
    }
    if (!currentSide) {
      showMeasurementError("Select or create a side first.");
      return;
    }

    const room = currentRoom();

    if (editingPoint) {
      const sideChanged = editingPoint.side !== currentSide;
      editingPoint.value = value;
      if (sideChanged) {
        const siblings = pointsInSide(room.id, currentSide);
        const maxOrder = siblings.length ? Math.max(...siblings.map(p => p.order)) : 0;
        editingPoint.side = currentSide;
        editingPoint.order = maxOrder + 1;
      }
    } else if (pendingAddPointCoords) {
      const siblings = pointsInSide(room.id, currentSide);
      const maxOrder = siblings.length ? Math.max(...siblings.map(p => p.order)) : 0;
      project.points.push({
        id: uid("pt"),
        roomId: room.id,
        side: currentSide,
        order: maxOrder + 1,
        x: pendingAddPointCoords.x,
        y: pendingAddPointCoords.y,
        value,
        excluded: false
      });
    }

    closeMeasurementModal();
    updateEmptyState();
    renderAllPoints();
    scheduleAutoSave();
  }

  /* ---------- Point rendering / interaction ---------- */

  function renderAllPoints() {
    els.pointsLayer.innerHTML = "";

    project.points.forEach(point => {
      const room = getRoom(point.roomId);
      if (!room) return;

      const el = document.createElement("div");
      el.className = "point" + (point.excluded ? " excludedPoint" : "");
      el.style.left = point.x + "px";
      el.style.top = point.y + "px";
      el.style.color = room.color;
      el.textContent = project.showOrderLabels ? labelFor(point) : (point.value || "");

      el.addEventListener("click", event => {
        event.stopPropagation();
        openPointContextMenu(point, event.clientX, event.clientY);
      });

      els.pointsLayer.appendChild(el);
    });
  }

  function openPointContextMenu(point, clientX, clientY) {
    contextPoint = point;
    const menu = els.pointContextMenu;
    menu.classList.remove("hidden");

    const maxLeft = window.innerWidth - menu.offsetWidth - 8;
    const maxTop = window.innerHeight - menu.offsetHeight - 8;
    menu.style.left = Math.max(8, Math.min(clientX, maxLeft)) + "px";
    menu.style.top = Math.max(8, Math.min(clientY, maxTop)) + "px";

    els.pointExcludeAction.textContent = point.excluded ? "Include in export" : "Exclude from export";
  }

  function hidePointContextMenu() {
    els.pointContextMenu.classList.add("hidden");
    contextPoint = null;
  }

  function handleDrawingAreaClick(event) {
    if (!els.pointContextMenu.classList.contains("hidden")) {
      hidePointContextMenu();
      return;
    }
    const rect = els.drawingArea.getBoundingClientRect();
    const x = (event.clientX - rect.left) / project.zoom;
    const y = (event.clientY - rect.top) / project.zoom;
    openMeasurementModalForNew(Math.round(x), Math.round(y));
  }

  /* ---------- Labels toggle ---------- */

  function toggleLabels() {
    project.showOrderLabels = !project.showOrderLabels;
    els.labelsBtn.classList.toggle("primaryButton", project.showOrderLabels);
    renderAllPoints();
    scheduleAutoSave();
  }

  /* ---------- Auto sort ---------- */

  function openAutoSortModal() {
    els.autoSortRoom.innerHTML = "";
    project.rooms.forEach(room => {
      const opt = document.createElement("option");
      opt.value = room.id;
      opt.textContent = room.name;
      els.autoSortRoom.appendChild(opt);
    });
    els.autoSortRoom.value = project.currentRoomId;
    renderAutoSortSidesList();
    updateAutoSortDirectionVisibility();
    els.autoSortModal.classList.remove("hidden");
  }

  function renderAutoSortSidesList() {
    const room = getRoom(els.autoSortRoom.value);
    els.autoSortSidesList.innerHTML = "";

    if (!room || !room.sideTags.length) {
      els.autoSortSidesList.innerHTML = '<span class="hint">This room has no sides yet.</span>';
      return;
    }

    room.sideTags.forEach(side => {
      const label = document.createElement("label");
      label.className = "radioChoice";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = side;
      checkbox.checked = side === room.lastSelectedSide;
      const span = document.createElement("span");
      span.textContent = side;
      label.appendChild(checkbox);
      label.appendChild(span);
      els.autoSortSidesList.appendChild(label);
    });
  }

  function updateAutoSortDirectionVisibility() {
    const method = els.autoSortMethodChoices.find(c => c.checked).value;
    els.positionDirectionField.style.display = method === "position" ? "" : "none";
    els.angleDirectionField.style.display = method === "angle" ? "" : "none";
  }

  function sortSideByPosition(roomId, side, dir) {
    const pts = pointsInSide(roomId, side).slice();
    if (dir === "lr") pts.sort((a, b) => a.x - b.x);
    else if (dir === "rl") pts.sort((a, b) => b.x - a.x);
    else if (dir === "tb") pts.sort((a, b) => a.y - b.y);
    else pts.sort((a, b) => b.y - a.y); // bt
    pts.forEach((p, i) => { p.order = i + 1; });
  }

  function sortSideByAngle(roomId, side, clockwise) {
    const pts = pointsInSide(roomId, side).slice();
    if (pts.length <= 1) return;

    const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
    const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

    const withAngles = pts.map(point => {
      let angle = Math.atan2(point.y - cy, point.x - cx);
      if (angle < 0) angle += 2 * Math.PI;
      return { point, angle };
    });

    withAngles.sort((a, b) => a.angle - b.angle);

    let maxGap = -1;
    let seamIndex = 0;
    for (let i = 0; i < withAngles.length; i += 1) {
      const current = withAngles[i].angle;
      const isLast = i === withAngles.length - 1;
      const next = withAngles[isLast ? 0 : i + 1].angle + (isLast ? 2 * Math.PI : 0);
      const gap = next - current;
      if (gap > maxGap) { maxGap = gap; seamIndex = isLast ? 0 : i + 1; }
    }

    const rotated = withAngles.slice(seamIndex).concat(withAngles.slice(0, seamIndex));
    const ordered = clockwise ? rotated : rotated.slice().reverse();
    ordered.forEach((item, i) => { item.point.order = i + 1; });
  }

  function confirmAutoSort() {
    const roomId = els.autoSortRoom.value;
    const room = getRoom(roomId);
    const targets = Array.from(els.autoSortSidesList.querySelectorAll("input:checked")).map(cb => cb.value);
    const method = els.autoSortMethodChoices.find(c => c.checked).value;

    if (!room || !targets.length) { setStatus("Choose at least one side to sort."); return; }

    if (method === "angle") {
      const clockwise = els.autoSortAngleDirChoices.find(c => c.checked).value === "cw";
      targets.forEach(side => sortSideByAngle(roomId, side, clockwise));
    } else {
      const dir = els.autoSortPosDirChoices.find(c => c.checked).value;
      targets.forEach(side => sortSideByPosition(roomId, side, dir));
    }

    els.autoSortModal.classList.add("hidden");
    renderAllPoints();
    scheduleAutoSave();
    setStatus(`Sorted ${targets.join(", ")} in "${room.name}".`);
  }

  /* ---------- CSV export ---------- */

  function cleanCSV(value) {
    const text = String(value == null ? "" : value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportCSV() {
    openFileNameModal("Export CSV", "measurements", chosen => {
      if (!chosen) return;
      const fileName = chosen.toLowerCase().endsWith(".csv") ? chosen : chosen + ".csv";

      const rows = project.points
        .slice()
        .sort((a, b) => {
          const roomA = getRoom(a.roomId)?.name || "";
          const roomB = getRoom(b.roomId)?.name || "";
          return roomA.localeCompare(roomB) || String(a.side).localeCompare(String(b.side)) || a.order - b.order;
        });

      let csv = ["Room", "Side", "Seq", "Label", "Value", "Excluded"].map(cleanCSV).join(",") + "\n";
      rows.forEach(point => {
        const room = getRoom(point.roomId);
        csv += [room ? room.name : "", point.side, seqOf(point), labelFor(point), point.value, point.excluded ? "Yes" : ""]
          .map(cleanCSV).join(",") + "\n";
      });

      downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), fileName);
    });
  }

  /* ---------- Generic filename prompt ---------- */

  let fileNameCallback = null;

  function openFileNameModal(title, defaultName, callback) {
    els.fileNameModalTitle.textContent = title;
    els.fileNameInput.value = defaultName;
    fileNameCallback = callback;
    els.fileNameModal.classList.remove("hidden");
  }

  function closeFileNameModal(result) {
    els.fileNameModal.classList.add("hidden");
    const cb = fileNameCallback;
    fileNameCallback = null;
    if (cb) cb(result);
  }

  /* ---------- Event wiring ---------- */

  function bindEvents() {
    els.newProjectBtn.addEventListener("click", startNewProject);

    els.importPdfBtn.addEventListener("click", () => { els.pdfFileInput.value = ""; els.pdfFileInput.click(); });
    els.pdfFileInput.addEventListener("change", event => {
      const file = event.target.files && event.target.files[0];
      if (file) handlePdfFile(file);
    });

    els.importImageBtn.addEventListener("click", () => { els.imageFileInput.value = ""; els.imageFileInput.click(); });
    els.imageFileInput.addEventListener("change", event => {
      const file = event.target.files && event.target.files[0];
      if (file) handleImageFile(file);
    });

    els.zoomOutBtn.addEventListener("click", () => changeZoom(-0.25));
    els.zoomInBtn.addEventListener("click", () => changeZoom(0.25));
    els.fitBtn.addEventListener("click", fitToScreen);

    els.labelsBtn.addEventListener("click", toggleLabels);
    els.exportCsvBtn.addEventListener("click", exportCSV);

    els.drawingArea.addEventListener("click", handleDrawingAreaClick);

    document.addEventListener("click", event => {
      if (!els.pointContextMenu.contains(event.target)) hidePointContextMenu();
    });

    els.pointEditAction.addEventListener("click", () => {
      const point = contextPoint;
      hidePointContextMenu();
      if (point) openMeasurementModalForEdit(point);
    });
    els.pointExcludeAction.addEventListener("click", () => {
      const point = contextPoint;
      hidePointContextMenu();
      if (point) { point.excluded = !point.excluded; renderAllPoints(); scheduleAutoSave(); }
    });
    els.pointDeleteAction.addEventListener("click", () => {
      const point = contextPoint;
      hidePointContextMenu();
      if (point && confirm("Delete this point?")) {
        project.points = project.points.filter(p => p.id !== point.id);
        renderAllPoints();
        scheduleAutoSave();
      }
    });

    // Measurement keypad
    els.measurementModal.querySelectorAll("[data-key]").forEach(button => {
      button.addEventListener("click", () => appendMeasurementValue(button.dataset.key));
    });
    els.measurementModal.querySelectorAll("[data-fraction]").forEach(button => {
      button.addEventListener("click", () => appendMeasurementFraction(button.dataset.fraction));
    });
    els.measurementModal.querySelector('[data-action="backspace"]').addEventListener("click", measurementBackspace);
    els.measurementModal.querySelector('[data-action="clear"]').addEventListener("click", clearMeasurement);
    els.measurementModal.querySelector('[data-action="negative"]').addEventListener("click", toggleMeasurementNegative);
    els.measurementModal.querySelector('[data-action="confirm"]').addEventListener("click", confirmMeasurement);
    els.cancelMeasurementBtn.addEventListener("click", closeMeasurementModal);

    // Side tag add modal
    els.confirmSideNameBtn.addEventListener("click", confirmAddSideTag);
    els.cancelSideNameBtn.addEventListener("click", () => els.sideNameModal.classList.add("hidden"));
    els.sideNameInput.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); confirmAddSideTag(); }
    });

    // Room picker
    els.roomPickerBtn.addEventListener("click", openRoomPicker);
    els.cancelRoomPickerBtn.addEventListener("click", () => els.roomPickerModal.classList.add("hidden"));
    els.manageRoomsFromPickerBtn.addEventListener("click", () => {
      els.roomPickerModal.classList.add("hidden");
      openManageRoomsModal();
    });

    // Manage rooms
    els.closeManageRoomsBtn.addEventListener("click", () => els.manageRoomsModal.classList.add("hidden"));
    els.addRoomFromManageBtn.addEventListener("click", () => {
      roomModalFromManage = true;
      openAddRoomModal();
    });

    // Add room
    els.cancelRoomBtn.addEventListener("click", () => {
      els.roomModal.classList.add("hidden");
      if (pendingDeleteRoomId) {
        openReassignRoomModal(pendingDeleteRoomId);
        return;
      }
      if (roomModalFromManage) {
        roomModalFromManage = false;
        renderManageRoomsList();
        els.manageRoomsModal.classList.remove("hidden");
      }
    });
    els.confirmRoomBtn.addEventListener("click", confirmAddRoom);

    // Reassign-before-delete
    els.cancelReassignRoomBtn.addEventListener("click", () => {
      pendingDeleteRoomId = null;
      els.reassignRoomModal.classList.add("hidden");
      renderManageRoomsList();
      els.manageRoomsModal.classList.remove("hidden");
    });
    els.deleteRoomPermanentlyBtn.addEventListener("click", () => {
      if (!pendingDeleteRoomId) return;
      deleteRoomAndPoints(pendingDeleteRoomId);
      pendingDeleteRoomId = null;
      els.reassignRoomModal.classList.add("hidden");
      renderManageRoomsList();
      els.manageRoomsModal.classList.remove("hidden");
    });

    // Auto sort
    els.autoSortBtn.addEventListener("click", openAutoSortModal);
    els.cancelAutoSortBtn.addEventListener("click", () => els.autoSortModal.classList.add("hidden"));
    els.confirmAutoSortBtn.addEventListener("click", confirmAutoSort);
    els.autoSortRoom.addEventListener("change", renderAutoSortSidesList);
    els.autoSortMethodChoices.forEach(radio => {
      radio.addEventListener("change", updateAutoSortDirectionVisibility);
    });

    // Filename modal
    els.confirmFileNameBtn.addEventListener("click", () => closeFileNameModal(els.fileNameInput.value.trim() || null));
    els.cancelFileNameBtn.addEventListener("click", () => closeFileNameModal(null));
    els.fileNameInput.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); closeFileNameModal(els.fileNameInput.value.trim() || null); }
    });
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => App.init());
