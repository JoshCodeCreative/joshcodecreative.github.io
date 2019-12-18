(function ($) {

    class Stage {
        constructor() {
            this.elems = []; //ARRAY OF ENTITIES
            this.grid; //ENTITY
            //flags...
            this.isDragging = false;
            this.isAnimating = false;
        }
        toJSON() {
            let json = {
                elems: this.elems,
            }
            return json;
        }
    }

    class Elem {
        constructor(id) {
            this.id = id;
            this.isDraggable;
            this.isDroppable;
            this.isDropzone;

            this.isTopLevel; //TODO: yet to be implemented, but important to track. isTopLevel is a different question than isInDropzone (only because NONSTANDARD usage allows both to be false). 
            //This would be needed for save/load reconstruction processes, but also likely useful elsewhere.

            this.isInDropzone;

            //TODO: not yet implemented...
            this.isInGrid; //boolean
            this.gridX;//num...
            this.gridY;//...these can be used to find the parent grid cell.

            /*
            //TODO: TBD: the below info might be needed to rebuild the session:
            this.isCollided;
            this.isColliding;
            this.absX;
            this.absY;
            this.cssLeft;
            this.cssTop;
            this.rotation;
            this.flipped;
            */
        }
        toJSON() {
            let json = {
                //TBD
            }
            return json;
        }
    }

    class Grid {
        //stage can have only 1 instance of Grid. All elems are in stage, only some elems are in grid.
        constructor(settings) {
            this.cols = settings.cols; //num e.g. 5
            this.rows = settings.rows; //num 
            this.scale = settings.scale; //px value grid cell dimension
            this.cells = []; //ARRAY OF ENTITIES
        }
        toJSON() {
            let json = {
                cells: this.cells,
            }
            return json;
        }
    }

    class Cell {
        constructor(settings) {
            this.x = settings.x;
            this.y = settings.y;
            this.elemIds = [];//array of kdElems inside the grid cell - not recursive.
        }
        toJSON() {
            let json = {
                //TBD
            }
            return json;
        }
    }

    $.fn.extend({
        killerDrag: function (userSettings) {
            this.defaultSettings = {
                //some way nice defaults
                initialization: {
                    controlsCanvasId: "MySessionControls",
                },
                grid: { 
                    enable: false,
                    scale: 1, 
                    cols: 1, //set to 1 because it will grow as needed when grid is built.
                    rows: 1,
                    cellPadding: 1, //in PX. This val will be applied on all 4 sides of largest elem when determining outer grid cell dimensions.

                    //TODO: NOT YET IMPLEMENTED
                    centerElems: false,
                    autoGrow: true,
                    autoShrink: true,
                    //outerCells: 1, //Min 1 for now. If 0, I don't know how autoGrow can work! drag offscreen? Would not be a good UX anyways.
                },
                draggables: {
                    dragThreshold: 10,
                    ignoreFocusableElems: true,
                },
                dropzones: {
                    scoopOnMouseup: true,
                    scoopWhileDragging: false,
                    centerDroppables: true,
                    //TODO: rename to elemOffsetX/Y
                    droppablePosLeft: 8,
                    droppablePosTop: 8,
                    //TODO: maxNestingLevels: 0, ... default 0 for infinite 
                    //future release...? flowDroppables... for large dropzones that act like mini grids 
                    // *** (at that point you could just instantiate another KD inside the dropzone, right? yikes lets not)
                },
                //TODO: Planned for 2.8: rotation, aka "spinnables"
                spinnables: {
                    //looks for spin handle, otherwise spins from click xy
                    snapDegrees: 5, //degrees to snap to
                    //TODO: kd_spin_handle and kd_drag_handle need to be things
                    randomSkew: 5, //max number of degrees to randomly skew each card at all times. Intended to simulate physical paper. Cool effect.
                },
                //TODO: Planned for 2.8: "flippables"
                flippables: {
                    //looks for flip handle, otherwise flips on click.
                    //if no reverse side, blank side is shown and content is obscured.
                    //so some core css is now involved!
                },
                /*future release: "smashables"
                smashables: {
                    pushDraggables: false, //etc
                },
                */
                collisions: {
                    collisionTolerance: 0,
                    //? stopOnCollision: true, //draggable colliding with smashy will not pass when dragged
                    //? revertAfterCollide: false //draggable colliding with smashy will revert on mouseup
                },
                flow: {
                    //distributes elems so they aren't overlapping.
                    enable: true,
                    cols: 6,
                    spacing: 33,
                },
                animation: {
                    // duration to animate each event type.
                    // 0 = disable animation script
                    drop: 200,
                    revert: 600,
                    snap: 1000,

                    //TODO: NOT YET IMPLEMENTED
                    spin: 800,

                    //autoposition on stage  init is now called "flow" (vs snap, which refers to snapping grid elems only)
                    flow: 500, //controls slide duration
                    flowStagger: 200,
                    flowFade: 500,
                },
                debug: {
                    warnings: true,
                    events: true,
                    performance: true,
                    verbose: false,
                }
            };

            var settings = $.extend(true, this.defaultSettings, userSettings);

            return this.each(function (i) {
                var $this = $(this);

                if (settings.debug.events) {
                    console.log("Hello from the KillerDrag return function. Resolved settings:");
                    console.log(settings);
                }

                var stage = new Stage(settings);

                //create a public methods object to a) use here if needed and b) pass along to the killerDrag instance
                var methods = new PluginMethods($this, settings, stage);

                methods.init(stage);

                //expose the methods data for public use
                $this.data('killerDrag', methods);
            });
            //END RETURN.
        }
    });

    function PluginMethods($el, settings, stage) {
        // Keep reference to the jQuery element,
        // and any other data that you want to share between methods and expose to the instance
        this.$el = $el;
        this.settings = settings;
        this.stage = stage;
    }

    $.extend(PluginMethods.prototype, {
        init: function () {

            if (this.settings.debug.performance) {
                console.log("kd.init.performance.now() :");
                console.log(performance.now());
            }

            //todo: are these references or COPIES? you better know. I think they are copies and you must update in the reverse direction later.
            var instance = this;
            var $stage = this.$el;
            var settings = this.settings;
            var stage = this.stage;

            //make sure stage is positioned:
            let stageCss = $stage.css("position");
            if (!(stageCss === "fixed" || stageCss === "absolute" || stageCss === "relative")) {
                $stage.css("position", "relative");
            }
            $stage.attr("data-kd-stage", "true").addClass("kd_stage");

            //jquery obj set representing all killerdrag elements within this instance
            var $allElems = $stage.find(".kd_draggable, .kd_droppable, .kd_dropzone, .kd_smashy");

            elemId = 1;

            $allElems.each(function () {
                var $elem = $(this);

                $elem.attr("data-elem-id", elemId);

                var elem = new Elem(elemId);

                stage.elems.push(elem);

                $elem.attr("data-kd-elem", "true"); //killerdrag has touched this element...
                $elem.attr("data-collidable", "true"); //all KD element types require collisions

                //all KD elems must have abs positioning.
                $elem.css("position", "absolute").css("margin", "0").css("z-index", "1");

                //start all elems with a z-index of 1.
                let newZObj = {
                    "elemId": elemId,
                    "value": 1, //the initial z index value
                }

                //am I a draggable?
                if ($elem.hasClass("kd_draggable")) {
                    elem.isDraggable = true;
                    $elem.attr("data-draggable", "true");

                }

                //am I droppable?
                if ($elem.hasClass("kd_droppable")) {
                    elem.isDroppable = true;
                    $elem.attr("data-droppable", "true");
                }

                //am I a dropzone?
                if ($elem.hasClass("kd_dropzone")) {
                    elem.isDropzone = true;
                    $elem.attr("data-dropzone", "true");
                }

                //am I a smashy boi?
                if ($elem.hasClass("kd_smashy")) {
                    elem.isSmashy = true;
                    $elem.attr("data-smashy", "true");
                }

                //am I inside -anything-??
                if ($elem.parent().closest($allElems).length) {
                    elem.isNested = true;

                    $elem.attr("data-nested", "true");

                    instance.moveElemToPos($elem, settings.dropzones.droppablePosLeft, settings.dropzones.droppablePosTop);

                    //am I inside a dropzone?
                    let $parentDropzone = $elem.parent().closest(".kd_dropzone");
                    if ($parentDropzone.length) {
                        elem.isInDropzone = true;
                        $elem.attr("data-in-dropzone", "true");
                        if (elem.isDroppable) {
                            //do I need to center me?
                            if (settings.dropzones.centerDroppables) {
                                var centerCoords = instance.centerElemInElem($elem, $parentDropzone);
                                instance.moveElemToPos($elem, centerCoords.x, centerCoords.y, settings.animation.drop);
                            }
                        } else {
                            if (settings.debug.warnings) {
                                console.log("Warning: Elem is not a droppable but was inside of a dropzone on init.");
                                $elem.attr("data-warning", "true");
                            }
                        }
                    } else {
                        //no
                        if (settings.debug.warnings) {
                            console.log("Warning: Elem was inside of a non-dropzone elem on init.");
                        }
                        $elem.attr("data-warning", "true");
                    }
                }

                //$elem.data("elemData", elemData);
                elemId++;
            });

            var $draggables = $allElems.filter("[data-draggable]");
            var $droppables = $allElems.filter("[data-droppable]");
            var $dropzones = $allElems.filter("[data-dropzone]");
            var $smashys = $allElems.filter("[data-smashy]");

            //now loop again but for real
            $draggables.each(function () {
                var $elem = $(this);
                var elemId = parseInt($elem.attr("data-elem-id"));
                var elem = instance.getObjById(stage.elems, elemId);//access to the data version

                // disables natively browser draggings
                $elem.on("drag", function () {
                    return false;
                });

                //create array to save starting position in case we need to revert
                let dragStartingPosition = [0, 0];

                $elem.on("mousedown touchstart", function (event) {
                    //var elemData = $elem.data("elemData");
                    $target = $(event.target);

                    if (!$elem.is($target.closest("[data-draggable]"))) {
                        //for nested draggable elements. prevents parents from being dragged as well.
                        if (settings.debug.verbose) {
                            console.log("Mousedown canceled: " + $elem + " is a parent of a nested draggable.");
                        }
                        return;
                    }
                    if (settings.draggables.ignoreFocusableElems) {
                        //if the element clicked matches one of the jquery selectors provided in the ignoreFocusableElems array, cancel the drag.
                        let $selector = $('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, *[tabindex], *[contenteditable]')
                        if ($target.is($selector)) {
                            if (settings.debug.verbose) {
                                console.log("Mousedown cancelled due to exclusion of interactive child elements.");
                            }
                            return;
                        }
                    }

                    //dispatch mousedown event
                    var killer_event_mousedown = new CustomEvent("killer_event_mousedown", {
                        "detail": {
                            $elem: $elem,
                            $target: $target
                        }
                    });

                    document.dispatchEvent(killer_event_mousedown);
                    if (settings.debug.events) {
                        console.log("killer_event_mousedown");
                    }

                    isMouseDown = true;

                    //get absolute and relative (to positioned parent) position of draggable element. The latter is required for nested draggables.

                    //TODO: v2.8 ROTATION=SPIN
                    let elemRotation = $elem.attr("data-rotation");
                    var elemIsRotated = (elemRotation && elemRotation !== "0");

                    //account for rotation when starting a drag, there is a slight mismatch when measuring the new position. (unrotate momentarily)
                    if (elemIsRotated) {
                        //unrotate before measuring position
                        $elem.css("transform", "rotate(0deg)");
                    }

                    var posData = instance.getPositionData($elem);

                    if (elemIsRotated) {
                        //put rotation back
                        $elem.css("transform", "rotate(" + elemRotation + "deg)");
                    }

                    //measure distance of cursor from top left corner of draggable object
                    //The recommendation was to use clientX/Y but this causes problems when scrolling. I think we HAVE to use pageX/Y.
                    let shiftX = event.pageX - posData.absX;
                    let shiftY = event.pageY - posData.absY;

                    let initialCursorX = event.pageX;
                    let initialCursorY = event.pageY;

                    // *************************** DRAG *************************** //
                    function onMouseMove(event) {
                        let currentCursorX = event.pageX;
                        let currentCursorY = event.pageY;

                        //don't officially start the drag until the threshold is crossed
                        let diffX = Math.abs(initialCursorX - currentCursorX);
                        let diffY = Math.abs(initialCursorY - currentCursorY);

                        if (diffX < settings.draggables.dragThreshold && diffY < settings.draggables.dragThreshold) {
                            //mouse move was too small to register as a Drag.
                            return;
                        }

                        /* ------------ the threshold is crossed! ------------ */
                        if (!stage.isDragging) {
                            stage.isDragging = true;
                            $elem.attr("data-dragging", "true");

                            //while dragging, elem should be visually on top of all other elems. 
                            //That means z-index must be temporarily increased on either the elem or its top-most parent elem.
                            if ($elem.parents("[data-kd-elem]").length) {
                                let $topMostParent = $elem.parents("[data-kd-elem]").last();
                                $topMostParent.attr("data-active-parent", "true");
                                $topMostParent.css("z-index", "2");
                            } else {
                                $elem.css("z-index", "2");
                            }

                            instance.moveElemToEnd($elem);

                            var killer_event_drag_start = new CustomEvent("killer_event_drag_start", {
                                "detail": {
                                    //?"data": data,
                                    "$elem": $elem,
                                    "absPos": [posData.absX, posData.absY],
                                    "relPos": [posData.relX, posData.relY],
                                }
                            });

                            document.dispatchEvent(killer_event_drag_start);
                            if (settings.debug.events) {
                                console.log("killer_event_drag_start");
                            }
                            if ($elem.attr("data-in-dropzone") === "true") {
                                dragStartingPosition = [posData.relX, posData.relY];
                            } else {
                                dragStartingPosition = [posData.absX, posData.absY];
                            }

                        }

                        var newX = currentCursorX - shiftX;
                        var newY = currentCursorY - shiftY;

                        if (posData.absX !== posData.relX || posData.absY !== posData.relY) {
                            //the draggable is positioned relative to a parent element. calculate and apply the resulting offset.
                            var offsetX = posData.relX - posData.absX;
                            var offsetY = posData.relY - posData.absY;
                            newX = newX + offsetX;
                            newY = newY + offsetY;
                        }

                        //update the element position
                        $elem.css("left", newX + "px");
                        $elem.css("top", newY + "px");

                        //even if this element is just a draggable, it still might run into a smashy. So always check collisions...
                        var collisions = instance.checkCollisions($elem);

                        var collidedDropzones = $.grep(collisions, function (n) {
                            return ($(n).is("[data-dropzone]"));
                        });

                        var collidedDroppables = $.grep(collisions, function (n) {
                            return ($(n).is("[data-droppable]"));
                        });

                        //RESET SOME STUFF 
                        $dropzones.filter("[data-drop-ready]").removeAttr("data-drop-ready");
                        $droppables.filter("[data-being-scooped],[data-entering-dropzone]").removeAttr("data-being-scooped").removeAttr("data-entering-dropzone");

                        var $hostDropzone = $elem.parent().closest("[data-dropzone]");
                        let $newDropzone = $(collidedDropzones).last(); //using last because if colliding multiple nested dropzones we want to prioritize the child-most one

                        //am i dropping a droppable into a dropzone?
                        if (elem.isDroppable && collidedDropzones.length) {
                            if (elem.isInDropzone && $hostDropzone.is($newDropzone)) {
                                //no I am just hovering the host dropzone
                            } else {
                                //yes
                                $elem.attr("data-entering-dropzone", "true");
                                $($newDropzone).attr("data-drop-ready", "true");
                            }
                        }

                        //am i dragging a droppable out of a dropzone?
                        if (elem.isInDropzone && elem.isDroppable) {
                            if ($hostDropzone.is($newDropzone)) {
                                //Did not leave host dropzone yet
                                $elem.removeAttr("data-leaving-dropzone");
                                $hostDropzone.removeAttr("data-drag-out-pending");
                            } else {
                                //draggable has been removed from its parent dropzone
                                $elem.attr("data-leaving-dropzone", "true");
                                $hostDropzone.attr("data-drag-out-pending", "true");
                            }
                        }
                        //am I dragging a dropzone around?
                        if (elem.isDropzone) {
                            $elem.removeAttr("data-scooping");//reset this and check again

                            if (collidedDroppables.length) {
                                $.each(collidedDroppables, function () {
                                    var $droppable = $(this);
                                    /*another way to do it:
                                    var droppableData = $droppable.data("elemData"); if(droppableData.isInDropzone){}
                                    */
                                    if ($droppable.has($elem).length) {
                                        if (settings.debug.verbose) {
                                            console.log("dragging: thou shalt not scoop thy parent element");
                                        }
                                        //$droppable.css("background", "red");
                                        return;
                                    }

                                    if ($droppable.attr("data-in-dropzone")) {
                                        if (settings.debug.verbose) {
                                            console.log("cannot scoop up, already scooped");
                                        }
                                        return;
                                    }

                                    if (settings.dropzones.scoopWhileDragging) {

                                        //Don't check if $elem is droppable or $droppable is also dropzone. 

                                        instance.attachToDropzone($droppable, $elem);
                                        if (settings.debug.verbose) {
                                            console.log("WOAH!! TRACTOR BEAM SUCKED UP A DROPPABLE, IN CRAZY MODE!");
                                        }
                                        return;
                                    } else {

                                        // DO check if $elem is droppable and $droppable is also dropzone. 

                                        if ($elem.attr("data-droppable") && $droppable.attr("data-dropzone")) {
                                            //cancel scoop. dragged elem drops into the new dropzone rather than scooping it up.
                                            return;
                                        } else {

                                            // get ready to scoop after mouseup...
                                            if (settings.debug.verbose) {
                                                console.log("tractor beam is online!");
                                            }
                                            $elem.attr("data-scooping", "true");
                                            $elem.attr("data-drop-ready", "true");
                                            $droppable.attr("data-being-scooped", "true");
                                            $droppable.attr("data-entering-dropzone", "true");
                                        }
                                    }
                                });
                            }
                        }

                        //dispatch dragging event
                        var killer_event_dragging = new CustomEvent("killer_event_dragging", {
                            "detail": {
                                $elem: $elem,
                                newX: newX,
                                newY: newY
                            }
                        });

                        document.dispatchEvent(killer_event_dragging);
                        if (settings.debug.events) {
                            console.log("killer_event_dragging");
                        }
                    }

                    $(window).on("mousemove touchmove", function (event) {
                        onMouseMove(event);
                    });

                    // *************************** MOUSE UP / DRAG END *************************** //
                    //we must listen for mouseup on window, not $elem, because $elem might end up behind something else. So any mouseup event must end the drag.
                    $(window).on("mouseup touchend", function () {

                        if (settings.debug.verbose) {
                            console.log("mouseup... here's the elem:");
                            console.log(elem);
                        }

                        isMouseDown = false;
                        $(window).off("mousemove touchmove");
                        $(window).off("mouseup touchend");

                        if (stage.isDragging) {
                            stage.isDragging = false;
                            $elem.removeAttr("data-dragging");

                            //end temporary z-index increase that is applied during drag
                            if ($elem.parents("[data-kd-elem]").length) {
                                let $topMostParent = $elem.parents("[data-kd-elem]").last();
                                $topMostParent.removeAttr("data-active-parent");
                                $topMostParent.css("z-index", "1");

                            } else {
                                $elem.css("z-index", "1");
                            }

                            var collisions = instance.checkCollisions($elem);

                            var collidedDropzones = $.grep(collisions, function (n) {
                                return ($(n).is("[data-dropzone]"));
                            });

                            var collidedDroppables = $.grep(collisions, function (n) {
                                return ($(n).is("[data-droppable]"));
                            });

                            var $hostDropzone = $elem.parent().closest("[data-dropzone]");

                            //am i dropping a droppable into a dropzone?
                            if (elem.isDroppable) {

                                if (collidedDropzones.length) {
                                    let $newDropzone = $(collidedDropzones).last(); //using last because if colliding multiple nested dropzones we want to prioritize the child-most one

                                    if (elem.isInDropzone) {
                                        //in dropzone
                                        if ($hostDropzone.is($newDropzone)) {
                                            //and still primarily colliding with host
                                            if (settings.debug.verbose) {
                                                console.log("Revert position: Droppable never left host dropzone.");
                                            }
                                            instance.revertToPrevPos($elem, dragStartingPosition);
                                        } else {
                                            //primarily colliding with a DIFFERENT dropzone (switching from one dz to another)
                                            if (settings.debug.verbose) {
                                                console.log("Droppable was dragged from one dropzone directly into another.");
                                            }
                                            $elem.removeAttr("data-entering-dropzone");
                                            $elem.removeAttr("data-leaving-dropzone");
                                            $newDropzone.removeAttr("data-drop-ready");
                                            $hostDropzone.removeAttr("data-drag-out-pending");
                                            instance.attachToDropzone($elem, $newDropzone);
                                        }
                                    } else {
                                        //was not previously in a dropzone, dragging into one
                                        if (settings.debug.verbose) {
                                            console.log("Droppable was dropped into a dropzone.");
                                        }
                                        $elem.removeAttr("data-entering-dropzone");
                                        $newDropzone.removeAttr("data-drop-ready");
                                        instance.attachToDropzone($elem, $newDropzone);
                                    }
                                } else {
                                    //no dropzones are collided, are we just dragging out of one?
                                    if (elem.isInDropzone) {

                                        if (settings.debug.verbose) {
                                            console.log("Droppable has been removed from its host dropzone");
                                        }
                                        $elem.removeAttr("data-leaving-dropzone");
                                        $hostDropzone.removeAttr("data-drag-out-pending");

                                        instance.detachFromDropzone($elem, $stage);

                                        //TODO IF snap...
                                        let elemPosData = instance.getPositionData($elem);
                                        let stagePosData = instance.getPositionData($stage);

                                        if (stagePosData.absX !== 0 || stagePosData.absY !== 0) {
                                            console.log("stage is offset from document");
                                        }

                                        let elemPos = [elemPosData.absX - stagePosData.absX, elemPosData.absY - stagePosData.absY];


                                        let snappedPos = instance.roundToGridScale(elemPos);

                                        console.log("snapp");

                                        //SNAP! (apply padding as well)
                                        instance.moveElemToPos($elem, snappedPos[0] + settings.grid.cellPadding, snappedPos[1] + settings.grid.cellPadding, true, 500);

                                        //TODO IF elem should be assigned as a new grid elem...
                                        var cellXCoord = snappedPos[0] / stage.grid.scale;
                                        var cellYCoord = snappedPos[1] / stage.grid.scale;
                                        console.log(cellXCoord);
                                        console.log(cellYCoord);

                                        var cells = stage.grid.cells;
                                        console.log(cells);
                                        var cell = instance.getCellByCoords(cells, cellXCoord, cellYCoord);

                                        if (cell) {
                                            instance.assignToCell($elem, cell)
                                        } else {
                                            console.log("No cell found. Out of grid?");
                                        }

                                        elem.isInDropzone = false;
                                    }
                                }
                            }

                            //did I just release a dropzone? It can scoop up free droppables.
                            if (elem.isDropzone) {
                                if (collidedDroppables.length) {

                                    $.each(collidedDroppables, function () {
                                        var $droppable = $(this);

                                        // This next check is very important, in the case of droppable dropzones. 
                                        // Obviously you can't scoop them and drop into them at the same time.
                                        // This stops the dropped elem from attempting to scoop up the thing it just dropped into.
                                        if ($droppable.has($elem).length) {
                                            if (settings.debug.verbose) {
                                                console.log("thou shalt not scoop thy parent element");
                                            }
                                            return;
                                        }

                                        //another important check
                                        if ($droppable.attr("data-in-dropzone")) {
                                            if (settings.debug.verbose) {
                                                console.log("mouseup: cannot scoop up, already scooped");
                                            }
                                            return;
                                        }

                                        //here comes the tractor beam!
                                        if ($droppable.attr("data-being-scooped")) {
                                            if (settings.debug.verbose) {
                                                console.log("TRACTOR BEAM!!!");
                                            }
                                            instance.attachToDropzone($droppable, $elem);
                                        }

                                        $droppable.removeAttr("data-being-scooped");
                                    });
                                } else {
                                    if (settings.debug.verbose) {
                                        console.log("Tractor Beam powered down.");
                                    }
                                }

                                //CLEANUPS post-mousup
                                $elem.removeAttr("data-scooping");
                                $elem.removeAttr("data-drop-ready");

                                //TODO: I don't totally love this pattern but what else, put everything in a temp array?
                                $("[data-being-scooped]").removeAttr("data-being-scooped");
                                $("[data-entering-dropzone]").removeAttr("data-entering-dropzone");

                                //updateCollisions(settings);

                            }


                            //dispatch drag end event
                            var killer_event_drag_end = new CustomEvent("killer_event_drag_end", {
                                "detail": {
                                    $elem: $elem
                                }
                            });
                            document.dispatchEvent(killer_event_drag_end);
                            if (settings.debug.events) {
                                console.log("killer_event_drag_end");
                            }
                        } else {
                            //mouse was down but no drag occurred
                            //dispatch click event
                            var killer_event_click = new CustomEvent("killer_event_click", {
                                "detail": {
                                    $elem: $elem
                                }
                            });
                            document.dispatchEvent(killer_event_click);
                            if (settings.debug.events) {
                                console.log("killer_event_click. Position Data:");
                                console.log(instance.getPositionData($elem));
                            }
                        }
                    });
                });
            });

            //END DRAGGABLES.EACH()
            $droppables.each(function () {
                var $parentDz = $(this).parent().closest(".kd_dropzone");
                if ($parentDz.length) {
                    if (settings.debug.verbose) {
                        console.log("Attach to DZ on init");
                        instance.attachToDropzone($(this), $parentDz);
                    }
                }
            });

            //do more init stuff...
            if (settings.flow.enable && !settings.grid.enable) {
                //apply flow on init (unless grid is enabled too)
                instance.flowElems($allElems);
            }

            //APPLY GRID
            if (settings.grid.enable) {
                var grid = instance.buildGrid();
                this.stage.grid = grid;
                //...

                //now distribute all top level elems into the grid cells
                $allElems.each(function () {
                    var $elem = $(this);
                    var elemId = parseInt($elem.attr("data-elem-id"));
                    var elem = instance.getObjById(stage.elems, elemId);//access to the data version

                    if (elem.isInDropzone) {
                        //exclude child elems
                        return;
                    } else {
                        var freeCell = instance.getFreeCell();

                        if (settings.debug.verbose) {
                            console.log("nextFreeCell");
                            console.log(freeCell);
                        }
                        freeCell.elemIds.push(elem.id);

                        var pos = instance.convertGridToPx([freeCell.x, freeCell.y]);


                        //center?
                        if (settings.grid.centerElems) {
                            let x = (settings.grid.scale - $elem.outerWidth()) / 2;
                            let y = (settings.grid.scale - $elem.outerHeight()) / 2;
                            pos[0] = pos[0] + x;
                            pos[1] = pos[1] + y;
                        } else {
                            //apply any padding
                            pos[0] = pos[0] + settings.grid.cellPadding;
                            pos[1] = pos[1] + settings.grid.cellPadding;
                        }

                        instance.moveElemToPos($elem, pos[0], pos[1]);
                    }
                });

            }

            //Keyboard Controls!
            //THIS IS JUST A TEMP TEST IMPLEMENTATION
            Mousetrap.bind('shift+up', function () {
                console.log("up");
                var $elem = $("[data-kd-elem]:focus").first();
                var t = instance.cssNumber($elem, "top");
                $elem.css("top", t - 1 + "px");
            });
            Mousetrap.bind('shift+down', function () {
                console.log("down");
                var $elem = $("[data-kd-elem]:focus").first();
                var t = instance.cssNumber($elem, "top");
                $elem.css("top", t + 1 + "px");
            });
            Mousetrap.bind('shift+left', function () {
                console.log("left");
                var $elem = $("[data-kd-elem]:focus").first();
                var l = instance.cssNumber($elem, "left");
                $elem.css("left", l - 1 + "px");
            });
            Mousetrap.bind('shift+right', function () {
                console.log("right");
                var $elem = $("[data-kd-elem]:focus").first();
                var l = instance.cssNumber($elem, "left");
                $elem.css("left", l + 1 + "px");
            });
            $allElems.attr("tabindex", "0");


            /*DO WE HAVE USER CONTROLS? TODO: in progress ... */
            if (settings.initialization.controlsCanvasId) {

                var $controlsCanvas = $("#" + settings.initialization.controlsCanvasId);

                $controlsCanvas.find("fieldset").each(function () {
                    var $fieldset = $(this);
                    var fieldSetName = $fieldset.find("legend").first().text();

                    if (settings.debug.controls) {
                        console.log("FIELDSET: " + propertyName);
                    }

                    $fieldset.find("[data-control]").each(function () {
                        var $control = $(this)
                        var propertyName = $control.attr("data-control");
                        if (settings.debug.controls) {
                            console.log(propertyName);
                        }
                        $control.on("change", function () {
                            var val = instance.getInputVal($(this));
                            console.log(fieldSetName + "->" + propertyName + ": " + val);
                        });
                    });
                });
            }

            //final cleanup after initialization
            /*$allElems.each(function () {
                //TODO: this was causing false collisions on init flow. Revisit.
                //some elems may have been in collision while being moved around
                instance.checkCollisions($(this));
            });*/

            if (settings.debug.events) {
                console.log("------------KillerDrag initialized------------");
                console.log(settings);
                console.log("----------------------------------------------");
            }
        },

        /*BEGIN GRID METHODS*/

        buildGrid: function () {

            //search the DOM inside the stage or use data first? and damn whatever gets left behind?
            $elems = this.$el.find("[data-kd-elem]");

            $topLevelElems = $elems.not("[data-in-dropzone]");

            var requiredSize = $topLevelElems.length;

            var scale = this.settings.grid.scale;
            var padding = this.settings.grid.cellPadding;
            if (this.settings.debug.verbose) {
                console.log("specified scale: " + scale);
                console.log("padding: " + padding);
                console.log("ELEMS LENGTH:");
                console.log($elems.length);
                console.log("TOP LEVEL ELEMS LENGTH:");
                console.log($topLevelElems.length);
            }
            $topLevelElems.each(function () {
                let d = Math.max($(this).outerWidth(), $(this).outerHeight());
                let r = d + (padding * 2);
                if (r > scale) {
                    scale = r;
                }
            });
            if (this.settings.debug.verbose) { console.log("resolved scale: " + scale); }
            this.settings.grid.scale = scale;

            //is startingElemsCount less than the number of cells specified by the user in the settings?
            var specifiedSize = (this.settings.grid.cols - 2) * (this.settings.grid.rows - 2);
            //-2 because we also want to have an empty cell on all sides of the outer part of the grid after everything is set up.

            if (specifiedSize < requiredSize) {
                //user grid size settings are no good
                //so create the grid size dynamically, as close to square as possible,
                //based on the minimum size it must be to support the stacks and orphaned cards.
                var sqrt = Math.floor(Math.sqrt(requiredSize));
                var quotient = Math.ceil(requiredSize / sqrt);
                //update the settings accordingly
                this.settings.grid.cols = quotient + 2;
                this.settings.grid.rows = sqrt + 2;
                if (this.settings.debug.verbose) {
                    var details = {
                        "requiredSize": requiredSize,
                        "specifiedSize": specifiedSize,
                        "settings.grid.cols": this.settings.grid.cols,
                        "settings.grid.rows": this.settings.grid.rows,
                    }
                    console.log("Applied programmatically generated grid size.");
                    console.log(details);
                }
            }
            //create Grid data object with updated settings
            var grid = new Grid(this.settings.grid);

            //now create the 'physical' grid in DOM
            this.$el.append("<div class='kd_grid'></div>");
            var $grid = this.$el.find(".kd_grid").first(); //first() future-proofs against NESTABLE GRIDS look out
            $grid.attr("data-kd-grid", "true").css("position", "relative");

            var cellId = 0;
            for (r = 0; r < this.settings.grid.rows; r++) {
                let $row = $($.parseHTML("<div class='kd_row' data-row='" + r + "'></div>"));
                $row.css("display", "flex");
                for (c = 0; c < this.settings.grid.cols; c++) {
                    //add to data
                    let cellSettings = {
                        "id": cellId,
                        "x": c,
                        "y": r
                    }
                    let cell = new Cell(cellSettings);
                    grid.cells.push(cell);
                    let cellTemplate = "<div class='kd_cell' data-row='" + r + "' data-col='" + c + "' style='height:" + this.settings.grid.scale + "px;width:" + this.settings.grid.scale + "px;'></div>";
                    //add to dom
                    let $cell = $($.parseHTML(cellTemplate));
                    $cell.css("flex-grow", "0").css("flex-shrink", "0");
                    $row.append($cell);
                    cellId++;
                }
                $grid.append($row);
            }
            return grid;
        },

        getFreeCell: function () {
            var settings = this.settings;
            //find and return the first empty gridCell, excluding the edge rows/cols
            var freeCell;
            for (const key of Object.keys(this.stage.grid.cells)) {
                let gridCol = this.stage.grid.cells[key].x;
                let gridRow = this.stage.grid.cells[key].y;
                if (gridRow === 0 || gridCol === 0 || gridRow + 1 === this.stage.grid.rows || gridCol + 1 === this.stage.grid.cols) {
                    //this cell is on the edge of the grid, so skip it
                    if (settings.debug.verbose) {
                        console.log("gridCell out of bounds");
                        console.log(this.stage.grid.cells[key]);
                    }
                    continue;
                }

                let hasContents = this.stage.grid.cells[key].elemIds.length;
                if (hasContents) {
                    //already occupied, keep looking 
                    if (settings.debug.verbose) {
                        console.log("gridCell ocupado");
                    }
                    continue;
                }
                freeCell = this.stage.grid.cells[key];
                if (settings.debug.verbose) {
                    console.log("targetCell Found!");
                }
                break;
            }
            if (!freeCell) {
                console.log("No available grid cell was found!")
                return;
            }
            return freeCell;
        },

        getCellByCoords: function (cells, x, y) {
            //search array of objects and return first one with matching id value
            let cell = cells.find(o => {
                return o.x === x && o.y === y;
            });
            if (cell) {
                return cell;
            } else {
                //there is no cell with those coords
                return false;
            }
        },

        convertGridToPx: function (gridCoords) {
            //converts grid xy coordinates to pixel values from top left of grid.
            //gridCoords is a [x,y] array
            let leftPx = this.stage.grid.scale * gridCoords[0];
            let topPx = this.stage.grid.scale * gridCoords[1];
            return [leftPx, topPx];
        },

        roundToGridScale: function (pos) {
            //pos is a [x,y] array
            let x = pos[0];
            let y = pos[1];
            let s = this.stage.grid.scale;
            let newX = Math.round(x / s) * s;
            let newY = Math.round(y / s) * s;
            return [newX, newY];
        },

        assignToCell: function ($elem, cell) {

            let elemId = $elem.attr("data-elem-id")

            cell.elemIds.push(elemId);

            if (this.settings.debug.verbose) {
                console.log("elem: ");
                console.log($elem);
                console.log("assigned to cell: ");
                console.log(cell);
            }

            var killer_event_assign_cell = new CustomEvent("killer_event_assign_cell", {
                "detail": {
                    $elem: $elem,
                    cell: cell,
                }
            });

            document.dispatchEvent(killer_event_assign_cell);

        },

        /*END GRID METHODS*/

        /*BEGIN UTILITY METHODS*/

        getObjById: function (array, id) {
            //search array of objects and return first one with matching id value
            let obj = array.find(o => {
                return o.id === id
            });
            return obj;
        },

        getInputVal: function ($input) {
            //IMO jQuery should return true or false based on checked when I ask for .val() of a checkbox input. jQuery disagrees. So here's this function.
            var val = $input.val();
            if ($input.attr("type") === "checkbox") {
                val = $input.is(':checked');
            }
            return val;
        },

        getPositionData: function ($elem) {

            let offset = $elem.offset();
            let position = $elem.position();

            let absX = offset.left;
            let absY = offset.top;

            let relX = position.left;
            let relY = position.top;

            var posData = {
                "absX": absX,
                "absY": absY,
                "relX": relX,
                "relY": relY
            }

            return posData;
        },

        cssNumber: function ($elem, prop) {
            //converts a css value e.g. "left: 20px" to a number e.g. 20
            var v = parseInt($elem.css(prop), 10);
            return isNaN(v) ? 0 : v;
        },

        // checkCollisions returns array of collision targets, and also updates data attributes.
        checkCollisions: function ($elem) {
            var instance = this;
            var settings = this.settings;
            
            let $collidables = $("[data-collidable]").not($elem).not($elem.find("[data-collidable]"));

            //get array of collided elements
            let collisions = instance.overlaps($collidables, $elem, settings.collisions.collisionTolerance);

            //reset all
            $collidables.removeAttr("data-collided").removeAttr("data-colliding");
            $elem.removeAttr("data-collided").removeAttr("data-colliding");

            //update DOM
            if (collisions.length) {
                $(collisions).attr("data-collided", "true");
                $elem.attr("data-colliding", "true");
            }
            return collisions;
        },

        overlaps: function ($a, $b, tolerance) {
            if (tolerance === parseInt(tolerance, 10)) {
                var tol = tolerance;
            } else {
                var tol = 0;
            }

            let hits = [];

            $a.each(function () {
                let bounds = $(this).offset();
                bounds.right = bounds.left + $(this).outerWidth() - tol;
                bounds.bottom = bounds.top + $(this).outerHeight() - tol;

                let compare = $b.offset();
                compare.right = compare.left + $b.outerWidth() - tol;
                compare.bottom = compare.top + $b.outerHeight() - tol;

                if (!(compare.right < bounds.left || compare.left > bounds.right || compare.bottom < bounds.top || compare.top > bounds.bottom)) {
                    hits.push(this);
                }
            });
            return hits;
        },

        attachToDropzone: function ($elem, $dropzone) {
            var instance = this;
            var settings = this.settings;

            var elemId = parseInt($elem.attr("data-elem-id"));
            var elem = instance.getObjById(this.stage.elems, elemId);//access to the data version

            if (settings.debug.verbose) {
                console.log("attachToDropzone()");
            }

            //remove from grid

            var killer_event_attach = new CustomEvent("killer_event_attach", {
                "detail": {
                    $elem: $elem,
                    $dropzone: $dropzone
                }
            });

            if (this.settings.animation.drop > 0) {
                //FIRST measure and adjust position to account for relative offset of DZ position.
                var elPos = instance.getPositionData($elem);
                var dzPos = instance.getPositionData($dropzone);

                var preAnimX = elPos.absX - dzPos.absX - this.settings.dropzones.droppablePosLeft;
                //console.log(preAnimX);
                var preAnimY = elPos.absY - dzPos.absY - this.settings.dropzones.droppablePosTop;
                //console.log(preAnimY);

                instance.moveElemToPos($elem, preAnimX, preAnimY);

                //THEN append
                $dropzone.append($elem);

                //THEN animate to final position... are we centering it?
                if (settings.dropzones.centerDroppables === true) {
                    let dzW = $dropzone.width();
                    let dzH = $dropzone.height();
                    let eH = $elem.height();
                    let eW = $elem.width();
                    let left = (dzW - eW) / 2;
                    let top = (dzH - eH) / 2;
                    instance.moveElemToPos($elem, left, top, this.settings.animation.drop);
                } else {
                    instance.moveElemToPos(
                        $elem,
                        this.settings.dropzones.droppablePosLeft,
                        this.settings.dropzones.droppablePosTop,
                        this.settings.animation.drop
                    );
                }
                $(document).bind("killer_event_move_elem_to_pos", function (e) {
                    if ($elem.is(e.detail.$elem)) {
                        document.dispatchEvent(killer_event_attach);
                        if (settings.debug.events) {
                            console.log("killer_event_attach");
                        }
                        $(document).unbind("killer_event_move_elem_to_pos");
                    }
                });
            } else {
                $dropzone.append($elem);
                instance.moveElemToPos(
                    $elem,
                    this.settings.dropzones.droppablePosLeft,
                    this.settings.dropzones.droppablePosTop
                );
            }

            //now update collisions on ALL PARENT DROPZONES to remove any flags
            let $allParentDropzones = $elem.parents("[data-dropzone]");
            instance.checkCollisions($allParentDropzones);

            //OR? simply update collisions on ALL COLLIDABLES
            //updateCollisions(settings);

            //update elem data
            $elem.removeAttr("data-colliding").removeAttr("data-collided");
            $elem.attr("data-nested", "true");
            $elem.attr("data-in-dropzone", "true");
            elem.isInDropzone = true;

        },

        detachFromDropzone: function ($elem, $detachTo) {
            var instance = this;

            //TODO: v2.8 SPIN
            let elemRotation = $elem.attr("data-rotation");
            const elemIsRotated = (elemRotation && elemRotation !== "0");

            //account for rotation when dragging out of a stack, there is a slight mismatch when measuring the new position. (unrotate momentarily)
            if (elemIsRotated) {
                //unrotate before measuring position
                $elem.css("transform", "rotate(0deg)");
            }

            var posData = instance.getPositionData($elem);

            if (elemIsRotated) {
                //put rotation back
                $elem.css("transform", "rotate(" + elemRotation + "deg)");
            }

            var stage_posData = instance.getPositionData($detachTo);

            if (stage_posData.absX !== 0 || stage_posData.absY !== 0) {
                console.log("stage is offset from document");
            }

            //TODO: future release... possible separate layer(s) for free cards?
            $detachTo.append($elem);

            instance.moveElemToPos($elem, posData.absX - stage_posData.absX, posData.absY - stage_posData.absY);

            $elem.removeAttr("data-nested");
            $elem.removeAttr("data-in-dropzone");

            //TODO: update data here as well, and probably return something
        },

        moveElemToPos: function ($elem, x, y, duration) {
            var killer_event_move_elem_to_pos = new CustomEvent("killer_event_move_elem_to_pos", {
                "detail": {
                    $elem: $elem,
                    x: x,
                    y: y,
                    duration: duration
                }
            });
            if (duration && duration > 0) {
                $elem.attr("data-animating", "true");
                $elem.animate({
                    left: x + "px",
                    top: y + "px"
                }, {
                    duration: duration,
                    complete: function () {
                        //wait to dispatch event

                        //TODO: no access to settings obj inside this function, so I am skipping the debug console logging for this event (it is mainly an internal event anyways)
                        document.dispatchEvent(killer_event_move_elem_to_pos);

                        $elem.removeAttr("data-animating");
                    }
                });
            } else {
                $elem.css("left", x + "px");
                $elem.css("top", y + "px");

                document.dispatchEvent(killer_event_move_elem_to_pos);
            }
        },


        moveElemToEnd: function ($elem) {
            //Move the elem to the end of its parent in the DOM and also to the end of any corresponding data array(s)
            //(Data arrays must be kept in sync with DOM for save/load to ever work!)

            let $parent = $elem.parent();

            let siblingElemsCount = $parent.children("[data-kd-elem]").length;
            console.log(siblingElemsCount);

            $elem.detach();
            $parent.append($elem);

            //TODO: move to end of its data array as well! 

        },


        revertToPrevPos: function ($elem, prevXY) {
            //TODO: how is this different from the moveElemTo function? Do we need both?
            var instance = this;
            var settings = this.settings;

            var killer_event_revert = new CustomEvent("killer_event_revert", {
                "detail": {
                    $elem: $elem
                }
            });

            if (settings.animation.revert > 0) {
                //all animation is now controlled by the moveElemToPos function.
                instance.moveElemToPos($elem, prevXY[0], prevXY[1], settings.animation.revert);
                $(document).bind("killer_event_move_elem_to_pos", function (e) {

                    document.dispatchEvent(killer_event_revert);
                    if (settings.debug.events) {
                        console.log("killer_event_revert");
                    }

                    $(document).unbind("killer_event_move_elem_to_pos");
                });
            } else {
                instance.moveElemToPos($elem, prevXY[0], prevXY[1]);
            }

            $elem.removeAttr("data-colliding");
            $elem.parents("[data-dropzone]").removeAttr("data-collided").removeAttr("data-drag-out-pending");

            if (!settings.animation.revert > 0) {
                document.dispatchEvent(killer_event_revert);
                if (settings.debug.events) {
                    console.log("killer_event_revert");
                }
            }

            return true;
        },

        flowElems: function ($elems) {
            var instance = this;
            var settings = this.settings;

            var cols = settings.flow.cols; //arbitrary number of elems in each row before rendering the next row
            var spacing = settings.flow.spacing; //arbitrary number of pixels to add to each subsequent topleft val
            var topleft = {
                "x": 0,
                "y": 0
            };
            var heightsInRow = [];

            function placeElem($elem, settings) {
                //do the slide effect?
                if (settings.animation.flow > 0) {
                    instance.moveElemToPos($elem, topleft.x + spacing, topleft.y + spacing, settings.animation.flow);
                } else {
                    instance.moveElemToPos($elem, topleft.x + spacing, topleft.y + spacing);
                }
                //do the fade up effect?
                if (settings.animation.flowFade > 0) {
                    //NOTE: doing it this way because jQuery.fadeUp() causes LINGERING and SEVERE performance issues. (why?)
                    $elem.animate({
                        opacity: 1
                    }, {
                        duration: settings.animation.flowFade,
                        queue: false,
                        complete: function () {
                            $elem.css("opacity", "");
                        }
                    });
                }
                let w = $elem.outerWidth();
                let h = $elem.outerHeight();
                heightsInRow.push(h);
                topleft.x = topleft.x + w + spacing;
                if (heightsInRow.length == cols) {
                    let max = Math.max(...heightsInRow);
                    topleft.x = 0;
                    topleft.y = topleft.y + max + spacing;
                    heightsInRow = [];
                }
            }

            $elems.each(function (i) {
                var $elem = $(this);
                if ($elem.attr("data-nested")) {
                    //only autoposition parent level elems
                    return;
                }

                //are we using the fade up effect?
                if (settings.animation.flow > 0 && settings.animation.flowFade > 0) {
                    $elem.css("opacity", "0");
                }

                //add the stagger effect?
                if (settings.animation.flow > 0 && settings.animation.flowStagger > 0) {
                    setTimeout(function () {
                        placeElem($elem, settings);
                    }, (settings.animation.flowStagger * i));
                } else {
                    placeElem($elem, settings);
                }

            });
        },

        centerElemInElem: function ($elA, $elB) {
            //returns left and top px values to center elA in elB
            let dzW = $elB.width();
            let dzH = $elB.height();
            let eH = $elA.height();
            let eW = $elA.width();
            let left = (dzW - eW) / 2;
            let top = (dzH - eH) / 2;
            let coord = {
                x: left,
                y: top
            };
            return coord;
        },

        randomSkew: function ($elem, max) {
            let startingRotation = isNaN($elem.attr("data-rotation")) ? 0 : $elem.attr("data-rotation");
            //let maxSkewPx = max;
            let num = Math.floor(Math.random() * max) + 0; // a 'random' number between 0 and maxSkewPx
            num *= Math.floor(Math.random() * 2) == 1 ? 1 : -1; // make it negative roughly half of the time
            let result = startingRotation + num;
            $elem.attr("data-rotation", result)
            $elem.css("transform", "rotate(" + result + "deg)");
            console.log(result);
        },

        publicMethod: function (str) {
            console.log("publicMethod: " + str);
            if (this.settings.debug.performance) {
                console.log("kd.publicMethod.performance.now() :");
                console.log(performance.now());
            }
        }
    });
})(jQuery);