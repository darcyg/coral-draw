function mxFreehand(graph)
{
	// Graph must have a container
	var svgElement = (graph.view != null && graph.view.canvas != null) ? graph.view.canvas.ownerSVGElement : null;
	
	if (graph.container == null || svgElement == null)
	{
		return;
	}
	
	//Code inspired by https://stackoverflow.com/questions/40324313/svg-smooth-freehand-drawing
	var bufferSize = mxFreehand.prototype.NORMAL_SMOOTHING;
	var path = null;
	var partPathes = [];
	var strPath;
	var drawPoints = [];
	var lastPart;
	var closedPath = false; 
	var autoClose = true;
	var buffer = []; // Contains the last positions of the mouse cursor
	var enabled = false;
	var stopClickEnabled = false;

	this.setClosedPath = function(isClosed)//TODO add closed settings
	{
		closedPath = isClosed;
	};
	
	this.setAutoClose = function(isAutoClose)//TODO add auto closed settings
	{
		autoClose = isAutoClose;
	};

	this.setStopClickEnabled = function(enabled)
	{
		stopClickEnabled = enabled;
	};
	
	this.setSmoothing = function(smoothing)//TODO add smoothing settings
	{
		bufferSize = smoothing;
	};
	
	var setEnabled = function(isEnabled)
	{
		enabled = isEnabled;
		graph.getRubberband().setEnabled(!isEnabled);
		graph.graphHandler.setSelectEnabled(!isEnabled);
		graph.graphHandler.setMoveEnabled(!isEnabled);
		graph.container.style.cursor = (isEnabled) ? 'crosshair' : '';
		graph.fireEvent(new mxEventObject('freehandStateChanged'));
	};
	
	this.startDrawing = function()
	{
		setEnabled(true);
	}
	
	this.isDrawing = function()
	{
		return enabled;
	};
	
	var endPath = mxUtils.bind(this, function(e)
	{
	    if (path) 
	    {
	    	// Click stops drawing
	    	var doStop = stopClickEnabled && drawPoints.length > 0 &&
	    		lastPart != null && lastPart.length < 2;
	    	
			if (!doStop)
			{
				drawPoints.push.apply(drawPoints, lastPart);
			}
			
	        lastPart = [];
			drawPoints.push(null);
	        partPathes.push(path);
	        path = null;
	        
			if (doStop)
			{
				this.stopDrawing();
			}
			
	        mxEvent.consume(e);
	    }
	});
	
	this.stopDrawing = function() 
	{
	    if (partPathes.length > 0) 
	    {
	        var maxX = drawPoints[0].x, minX = drawPoints[0].x, maxY = drawPoints[0].y, minY = drawPoints[0].y;
	        
	        for (var i = 1; i < drawPoints.length; i++) 
	        {
	        	if (drawPoints[i] == null) continue;
	        	
	        	maxX = Math.max(maxX, drawPoints[i].x);
	        	minX = Math.min(minX, drawPoints[i].x);
	        	maxY = Math.max(maxY, drawPoints[i].y);
	        	minY = Math.min(minY, drawPoints[i].y);
	        }
	        
	        var w = maxX - minX, h = maxY - minY;
	        
	        if (w > 0 && h > 0)
	        {
		        var xScale = 100 / w;
		        var yScale = 100 / h;
		        
		        drawPoints.map(function(p) 
		        {
		        	if (p == null) return p;
		        	
		        	p.x = (p.x - minX) * xScale;
		        	p.y = (p.y - minY) * yScale;
		        	return p;
		        });
		        
		        //toFixed(2) to reduce size of output
		        var drawShape = '<shape strokewidth="inherit"><foreground>';
		        
		        var start = 0;
		        
		        for (var i = 0; i < drawPoints.length; i++) 
		        {
		        	var p = drawPoints[i];

		        	if (p == null)
	        		{
		        		var tmpClosedPath = false;
				        var startP =  drawPoints[start], endP = drawPoints[i - 1];
				        
				        if (!closedPath && autoClose)
				        {
					        var xdiff = startP.x - endP.x, ydiff = startP.y - endP.y;
					        var startEndDist = Math.sqrt(xdiff * xdiff + ydiff * ydiff);
					        
					        tmpClosedPath = startEndDist <= graph.tolerance;
				        }
				        
				        if (closedPath || tmpClosedPath) 
			        	{
				        	drawShape += '<line x="'+ startP.x.toFixed(2) + '" y="' + startP.y.toFixed(2) + '"/>';
			        	}
				        
		        		drawShape += '</path>' + ((closedPath || tmpClosedPath)? '<fillstroke/>' : '<stroke/>');
		        		start = i + 1;
	        		}
		        	else if (i == start)
	        		{
		        		drawShape += '<path><move x="'+ p.x.toFixed(2) + '" y="' + p.y.toFixed(2) + '"/>'
	        		}
		        	else
		        	{
		        		drawShape += '<line x="'+ p.x.toFixed(2) + '" y="' + p.y.toFixed(2) + '"/>';
		        	}
		        }
		        
		        drawShape += '</foreground></shape>';
		        
                var style = mxConstants.STYLE_SHAPE + '=stencil(' + Graph.compress(drawShape) + ');fillColor=none;';
                var s = graph.view.scale;
            	var tr = graph.view.translate;
            	
                var cell = new mxCell('', new mxGeometry(minX / s - tr.x, minY / s - tr.y, w / s, h / s), style);
                cell.vertex = 1;
                
                graph.model.beginUpdate();
                try
				{
                	cell = graph.addCell(cell);
				}
                finally
				{
                	graph.model.endUpdate();
				}
                
                graph.fireEvent(new mxEventObject('cellsInserted', 'cells', [cell]));
                graph.fireEvent(new mxEventObject('freehandInserted', 'cell', cell));
                //While mouse is down, we cannot select!
                setTimeout(function(){graph.setSelectionCells([cell]); }, 10);
	        }

	        for (var i = 0; i < partPathes.length; i++)
	        {
	        	partPathes[i].parentNode.removeChild(partPathes[i]);
	        }
	        
	        path = null;
	        partPathes = [];
	        drawPoints = [];
	    }

        setEnabled(false);
	};
	
	mxEvent.addGestureListeners(svgElement, function (e) 
	{
		if (!enabled)
		{
			return;
		}
		
		var strokeWidth = parseFloat(graph.currentVertexStyle[mxConstants.STYLE_STROKEWIDTH] || 1);
		strokeWidth = Math.max(1, strokeWidth * graph.view.scale);
	    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	    path.setAttribute("fill", "none");
	    path.setAttribute("stroke", graph.currentVertexStyle[mxConstants.STYLE_STROKECOLOR] || "#000");
	    path.setAttribute("stroke-width", strokeWidth);
	    
	    if (graph.currentVertexStyle[mxConstants.STYLE_DASHED] == '1')
	    {
	    	var dashPattern = graph.currentVertexStyle[mxConstants.STYLE_DASH_PATTERN] || '3 3';
	    	
	    	dashPattern = dashPattern.split(' ').map(function(p)
			{
	    		return parseFloat(p) * strokeWidth;
			}).join(' ');
	    	path.setAttribute('stroke-dasharray', dashPattern);
	    }
	    
	    buffer = [];
	    var pt = getMousePosition(e);
	    appendToBuffer(pt);
	    strPath = "M" + pt.x + " " + pt.y;
	    drawPoints.push(pt);
	    lastPart = [];
	    path.setAttribute("d", strPath);
	    svgElement.appendChild(path);
	    mxEvent.consume(e);
	}, function (e) 
	{
	    if (path) 
	    {
	        appendToBuffer(getMousePosition(e));
	        updateSvgPath();
	        mxEvent.consume(e);
	    }
	}, endPath);

	var getMousePosition = function (e) 
	{
	    return mxUtils.convertPoint(graph.container, mxEvent.getClientX(e), mxEvent.getClientY(e));
	};

	var appendToBuffer = function (pt) 
	{
	    buffer.push(pt);
	    
	    while (buffer.length > bufferSize) 
	    {
	        buffer.shift();
	    }
	};

	// Calculate the average point, starting at offset in the buffer
	var getAveragePoint = function (offset) 
	{
	    var len = buffer.length;
	    
	    if (len % 2 === 1 || len >= bufferSize) 
	    {
	        var totalX = 0;
	        var totalY = 0;
	        var pt, i;
	        var count = 0;
	        
	        for (i = offset; i < len; i++) 
	        {
	            count++;
	            pt = buffer[i];
	            totalX += pt.x;
	            totalY += pt.y;
	        }
	        
	        return {
	            x: totalX / count,
	            y: totalY / count
	        }
	    }
	    
	    return null;
	};

	var updateSvgPath = function () 
	{
	    var pt = getAveragePoint(0);

	    if (pt) 
	    {
	        // Get the smoothed part of the path that will not change
	        strPath += " L" + pt.x + " " + pt.y;
	        drawPoints.push(pt);
	        // Get the last part of the path (close to the current mouse position)
	        // This part will change if the mouse moves again
	        var tmpPath = "";
	        lastPart = [];
	        
	        for (var offset = 2; offset < buffer.length; offset += 2) 
	        {
	            pt = getAveragePoint(offset);
	            tmpPath += " L" + pt.x + " " + pt.y;
	            lastPart.push(pt);
	        }

	        // Set the complete current path coordinates
	        path.setAttribute("d", strPath + tmpPath);
	    }
	};
};

mxFreehand.prototype.NO_SMOOTHING = 1;
mxFreehand.prototype.MILD_SMOOTHING = 4;
mxFreehand.prototype.NORMAL_SMOOTHING = 8;
mxFreehand.prototype.VERY_SMOOTH_SMOOTHING = 12;
mxFreehand.prototype.SUPER_SMOOTH_SMOOTHING = 16;
mxFreehand.prototype.HYPER_SMOOTH_SMOOTHING = 20;
