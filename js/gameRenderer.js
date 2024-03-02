var getRenderTexture = function(render, imagePath) {
    var image = render.textures[imagePath];

    if (image)
        return image;

    image = render.textures[imagePath] = new Image();
    image.src = imagePath;

    return image;
};

var renderBackground = function(render, background) {
    var cssBackground = background;

    if (/(jpg|gif|png)$/.test(background))
        cssBackground = 'url(' + background + ')';

    render.canvas.style.background = cssBackground;
    render.canvas.style.backgroundSize = "contain";
    render.currentBackground = background;
};

Matter.Render.bodies = function(render, bodies, context) {
    var c = context,
        engine = render.engine,
        options = render.options,
        showInternalEdges = options.showInternalEdges || !options.wireframes,
        showBorders = options.showBorders,
        body,
        part,
        mainPart,
        i,
        k;

    for (i = 0; i < bodies.length; i++) {
        body = bodies[i];

        if (!body.render.visible)
            continue;

        // handle compound parts
        for (k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
            //if (body.parts.length>2) console.log('parts',k,body.parts.length)
            part = body.parts[k];
            mainPart = body.parts[0];

            if (!part.render.visible)
                continue;

            if (options.showSleeping && body.isSleeping) {
                c.globalAlpha = 0.5 * part.render.opacity;
            } else if (part.render.opacity !== 1) {
                c.globalAlpha = part.render.opacity;
            }

            var renderSpriteTexture = part.render.sprite && part.render.sprite.texture && !options.wireframes
            var renderSpritePattern = part.render.sprite && part.render.sprite.texture && part.render.sprite.pattern && !options.wireframes
            var fillStyle = renderSpriteTexture ? part.render.sprite.fillStyle : part.render.fillStyle
            
            if (fillStyle || showBorders || renderSpritePattern) {
                // part polygon
                if (part.circleRadius) {
                    c.beginPath();
                    c.arc(part.position.x, part.position.y, part.circleRadius, 0, 2 * Math.PI);
                } else {
                    c.beginPath();
                    c.moveTo(part.vertices[0].x, part.vertices[0].y);

                    for (var j = 1; j < part.vertices.length; j++) {
                        if (!part.vertices[j - 1].isInternal || showInternalEdges) {
                            c.lineTo(part.vertices[j].x, part.vertices[j].y);
                        } else {
                            c.moveTo(part.vertices[j].x, part.vertices[j].y);
                        }

                        if (part.vertices[j].isInternal && !showInternalEdges) {
                            c.moveTo(part.vertices[(j + 1) % part.vertices.length].x, part.vertices[(j + 1) % part.vertices.length].y);
                        }
                    }

                    c.lineTo(part.vertices[0].x, part.vertices[0].y);
                    c.closePath();
                }

                if (!options.wireframes) {
                    c.fillStyle = fillStyle;
                    if (renderSpritePattern){
                        var texture = getRenderTexture(render, part.render.sprite.texture);
                        var ptrn = c.createPattern(texture, 'repeat')
                        c.fillStyle = ptrn;   
                    }

                    if (part.render.lineWidth) {
                        c.lineWidth = part.render.lineWidth;
                        c.strokeStyle = part.render.strokeStyle;
                        c.stroke();
                    }

                    c.fill();
    
                } else {
                    c.lineWidth = 1;
                    c.strokeStyle = '#bbb';
                    c.stroke();
                }
            }
            if (renderSpriteTexture) {
                // part sprite
                var sprite = part.render.sprite,
                    texture = getRenderTexture(render, sprite.texture);

                c.translate(part.position.x, part.position.y);
                var angle = part.angle
                if (body.parts.length>1 && body.parts[0].angle){
                    angle = body.parts[0].angle
                }
                c.rotate(angle);

                var bgsprite = part.render.bgsprite
                if (bgsprite){
                    var bgtexture = getRenderTexture(render, bgsprite.texture);
                    var xOffset = bgsprite.xOffset || 0.5
                    var yOffset = bgsprite.yOffset || 0.5
                    var xScale = bgsprite.xScale || 1
                    var yScale = bgsprite.yScale || 1
                    c.drawImage(
                        bgtexture,
                        bgtexture.width * -xOffset * bgsprite.xScale,
                        bgtexture.height * -yOffset * bgsprite.yScale,
                        bgtexture.width * xScale,
                        bgtexture.height * yScale
                    );
                }
                    

                c.drawImage(
                    texture,
                    texture.width * -sprite.xOffset * sprite.xScale,
                    texture.height * -sprite.yOffset * sprite.yScale,
                    texture.width * sprite.xScale,
                    texture.height * sprite.yScale
                );

                c.lineWidth = 1;
                c.strokeStyle = '#bbb';
                c.stroke();

                // revert translation, hopefully faster than save / restore
                c.rotate(-angle);
                c.translate(-part.position.x, -part.position.y);
            }

            if (part.render.text){ 
                var label = part.render.text.label
                if (part.render.text.variable){
                    if(part[part.render.text.variable]){
                        label = part.angle
                        if (part.render.text.fixed){
                            label.toFixed(part.render.text.fixed)
                        }
                    }
                }
                if (label){
                    c.translate(part.position.x, part.position.y);
                    if (body.parts.length>1){
                        c.rotate(body.parts[0].angle);
                    } else {
                        c.rotate(part.angle);
                    }
                    c.fillStyle = part.render.text.color||'#000000';
                    c.fillText(label,(part.render.text.offsetX||0),(part.render.text.offsetY||0))
                    if (body.parts.length>1){
                        c.rotate(-body.parts[0].angle);
                    } else {
                        c.rotate(-part.angle);
                    }
                    c.translate(-part.position.x, -part.position.y);
                }
            }

            c.globalAlpha = 1;
        }
    }
};

Matter.Render.world = function(render, time) {
    var Common = Matter.Common,
        Composite = Matter.Composite,
        Events = Matter.Events,
        Render = Matter.Render,
        Bounds = Matter.Bounds,
        Mouse = Matter.Mouse


    var startTime = Common.now(),
        engine = render.engine,
        world = engine.world,
        canvas = render.canvas,
        context = render.context,
        options = render.options,
        timing = render.timing;

    var allBodies = Composite.allBodies(world),
        allConstraints = Composite.allConstraints(world),
        background = options.wireframes ? options.wireframeBackground : options.background,
        bodies = [],
        constraints = [],
        i;

    var event = {
        timestamp: engine.timing.timestamp
    };

    Events.trigger(render, 'beforeRender', event);

    // apply background if it has changed
    if (render.currentBackground !== background)
        renderBackground(render, background);

    // clear the canvas with a transparent fill, to allow the canvas background to show
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = "transparent";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'source-over';

    // handle bounds
    if (options.hasBounds) {
        // filter out bodies that are not in view
        for (i = 0; i < allBodies.length; i++) {
            var body = allBodies[i];
            if (Bounds.overlaps(body.bounds, render.bounds))
                bodies.push(body);
        }

        // filter out constraints that are not in view
        for (i = 0; i < allConstraints.length; i++) {
            var constraint = allConstraints[i],
                bodyA = constraint.bodyA,
                bodyB = constraint.bodyB,
                pointAWorld = constraint.pointA,
                pointBWorld = constraint.pointB;

            if (bodyA) pointAWorld = Vector.add(bodyA.position, constraint.pointA);
            if (bodyB) pointBWorld = Vector.add(bodyB.position, constraint.pointB);

            if (!pointAWorld || !pointBWorld)
                continue;

            if (Bounds.contains(render.bounds, pointAWorld) || Bounds.contains(render.bounds, pointBWorld))
                constraints.push(constraint);
        }

        // transform the view
        Render.startViewTransform(render);

        // update mouse
        if (render.mouse) {
            Mouse.setScale(render.mouse, {
                x: (render.bounds.max.x - render.bounds.min.x) / render.options.width,
                y: (render.bounds.max.y - render.bounds.min.y) / render.options.height
            });

            Mouse.setOffset(render.mouse, render.bounds.min);
        }
    } else {
        constraints = allConstraints;
        bodies = allBodies;

        if (render.options.pixelRatio !== 1) {
            render.context.setTransform(render.options.pixelRatio, 0, 0, render.options.pixelRatio, 0, 0);
        }
    }

    if (!options.wireframes || (engine.enableSleeping && options.showSleeping)) {
        // fully featured rendering of bodies
        Matter.Render.bodies(render, bodies, context);
    } else {
        if (options.showConvexHulls)
            Render.bodyConvexHulls(render, bodies, context);

        // optimised method for wireframes only
        Render.bodyWireframes(render, bodies, context);
    }

    if (options.showBounds)
        Render.bodyBounds(render, bodies, context);

    if (options.debug){
        if (options.showAxes || options.showAngleIndicator)
        Render.bodyAxes(render, bodies, context);

        if (options.showPositions)
            Render.bodyPositions(render, bodies, context);

        if (options.showVelocity)
            Render.bodyVelocity(render, bodies, context);

        if (options.showIds)
            Render.bodyIds(render, bodies, context);

        if (options.showSeparations)
            Render.separations(render, engine.pairs.list, context);

        if (options.showCollisions)
            Render.collisions(render, engine.pairs.list, context);

        if (options.showVertexNumbers)
            Render.vertexNumbers(render, bodies, context);

        if (options.showMousePosition)
            Render.mousePosition(render, render.mouse, context);
    }


    Render.constraints(constraints, context);

    if (options.hasBounds) {
        // revert view transforms
        Render.endViewTransform(render);
    }

    Events.trigger(render, 'afterRender', event);

    // log the time elapsed computing this update
    timing.lastElapsed = Common.now() - startTime;
};

Matter.Render.bodyBounds = function(render, bodies, context) {
    var c = context,
        engine = render.engine,
        options = render.options;

    c.beginPath();

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i];

        if (body.render.visible) {
            var parts = bodies[i].parts;
            for (var j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
                var part = parts[j];
                c.rect(part.bounds.min.x, part.bounds.min.y, part.bounds.max.x - part.bounds.min.x, part.bounds.max.y - part.bounds.min.y);
            }
        }
    }

    if (options.wireframes) {
        c.strokeStyle = 'rgba(255,255,255,0.05)';
    } else {
        c.strokeStyle = options.boundColor||'rgba(0,0,0,0.1)';
    }

    c.lineWidth = 1;
    c.stroke();
    if (!options.wireframes) {
        Matter.Render.bodyWireframes(render, bodies, context);
    }
};