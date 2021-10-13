function Cell(o, i) {
	this._outer = o;
	this._inner = i;
}

Cell.prototype.getOuter = function() {
	return this._outer;
}

Cell.prototype.getInner = function() {
	return this._inner;
}

Cell.prototype.toString = function() {
	return "(" + this._outer + "," + this._inner + ")";
}

Cell.prototype.getRelatedCells = function(dim) {
	returned = [];
	// common outer cell
	for (var i = 1; i <= dim * dim; i++) {
		if (i != this._inner) {
			returned.push(new Cell(this._outer, i));
		}
	}
	// common row
	for (var i = 1; i <= dim * dim; i++) {
		if ((i != this._outer) && (Math.floor((i - 1) / dim) == Math.floor((this._outer - 1) / dim))) {
			for (var j = 1; j <= dim * dim; j++) {
				if (Math.floor((j - 1) / dim) == Math.floor((this._inner - 1) / dim)) {
					returned.push(new Cell(i, j));
				}
			}
		}
	}
	// common column
	for (var i = 1; i <= dim * dim; i++) {
		if ((i != this._outer) && (i % dim == this._outer % dim)) {
			for (var j = 1; j <= dim * dim; j++) {
				if (j % dim == this._inner % dim) {
					returned.push(new Cell(i, j));
				}
			}
		}
	}
	return returned;
}

Cell.prototype.getCandidates = function() {
	var returned = [];
	for (var i = 1; i <= sudoku.dimension * sudoku.dimension; i++) {
		returned.push(i);
	}
	related = this.getRelatedCells(sudoku.dimension);
	//alert("Related cells (" + related.length + "):" + JSON.stringify(related));
	$.each(related, function(i, v) {
		//console.log(">> " + JSON.stringify(v));
		grid_val = sudoku.getGridState(v);
		//console.log(">> Grid value: " + grid_val);
		if (grid_val !== null) {
			returned[grid_val - 1] = null;
		}
	});
	//console.log("Returning: " + JSON.stringify(this));
	//returned = [5, 6, 2, 1, 7, null, 8, null];
	return $.grep(
	returned, function(elt, ind) {
		return elt !== null;
	}).sort(function(a, b) {
		return a - b;
	});
}

function Theory(c, v) {
	this.cell = c;
	this.value = v;
}

Theory.prototype.toString = function() {
	return this.cell.getOuter() + "_" + this.cell.getInner() + "_" + this.value;
}

function NoAvailableValueException(cell) {
	this.cell = cell;
}

NoAvailableValueException.prototype.toString = function() {
	return this.cell.toString() + " can have no values in current theory";
}

function innerCellClick() {
	//console.log(JSON.stringify(sudoku.just_clicked));
	if (sudoku.just_clicked != null) {
		if (
		sudoku.just_clicked.getOuter() != $(this).data('outer') || sudoku.just_clicked.getInner() != $(this).data('inner')) {
			console.log("Need to toggle the style");
			var id_string = "#cell_" + sudoku.just_clicked.getOuter() + "_" + sudoku.just_clicked.getInner();
			$(id_string).removeClass('cell-selected');
		}
	}
	$(this).addClass('cell-selected');
	$('#cells').children().remove();
	theCell = new Cell($(this).data('outer'), $(this).data('inner'));
	sudoku.just_clicked = theCell;
	candidates = theCell.getCandidates();
	displayCandidates(candidates);
	console.log(JSON.stringify(candidates));
}


function simpleSolve() {
	var go_round_again = false;
	do {
		// iterate through free cells and determine if only one value can be there
		var sqDim = sudoku.dimension * sudoku.dimension;
		go_round_again = false;
		for (var i = 1; i <= sqDim; i++) {
			for (var j = 1; j <= sqDim; j++) {
				var cell = new Cell(i, j);
				if (sudoku.getGridState(cell) == null) {
					console.log("Examining cell " + cell.toString());
					// find the candidate values
					var candidates = cell.getCandidates();
					if (candidates.length == 0) {
						// this means we are barking up the wrong tree
						var message = "ERROR!! No values available for cell  " + cell.toString();
						var errorNode = $( '<span></span>' );
						errorNode.text( message );
						errorNode.addClass( 'error' );
						$('#diagnostics').append( errorNode );
						console.log("No values available for cell  " + cell.toString());
						return;
					} else if (candidates.length == 1) {
						console.log(cell.toString() + " = " + candidates[0]);
						sudoku.setCellInTheory(cell, candidates[0]);
						go_round_again = true;
					} else {
						//console.log( candidates.length + " values for cell " + cell.toString() );
					}
				}
			}
		}
	} while (go_round_again);
	console.log("simpleSolve complete");
}

function displayCandidates(arr) {
	$('#candidates').children().remove();
	$('#candidates').data( 'candidate-array', arr );
	$.each(arr, function(i, v) {
		var liNode = $('<li></li>');
		liNode.data('value', v);
		liNode.addClass('candidate-value');
		liNode.text(v);
		$('#candidates').append(liNode);
	});
	$('.candidate-value').hover(function() {
		$(this).addClass('candidate-hover');
	}, function() {
		$(this).removeClass('candidate-hover');
	});
	$('.candidate-value').click(selectCandidate);
}

function selectCandidate() {
	var selectedValue = $(this).data('value');
	var from = $(this).parent().data('candidate-array');
	console.log( "Selected " + selectedValue + ", alternatives: " + _.without( from, selectedValue ) );
	sudoku.speculateCellValue(sudoku.just_clicked, selectedValue);
}

function undo_click( e ) {
	alert("Undo theory " + $(this).data('theory'));
	sudoku.undoTheory();
	$( this ).parent().remove();
	mk_undo_anchor();
}

function mk_undo_anchor() {
	undo_anchor = $('<a class="undo" href="#">Undo</a>');
	undo_anchor.data('theory', sudoku.getTheoryDesignator());
	undo_anchor.click(undo_click);
	$('#theory-panel #theory li:last').append(undo_anchor);
}


sudoku = {
	dimension : 3,
	grid_state : [],
	theory_stack : [],
	just_clicked : null,
	solving_mode : false, // start off in setup
	viewModel : null,


	setDimension: function(n) {
		this.dimension = n;
	},
	
	updateModel: function(value) {
		console.log('Setting ' + JSON.stringify(this.just_clicked) + ' to ' + value);
		this.grid_state[this.just_clicked.getOuter() - 1][this.just_clicked.getInner() - 1] = value;
		var cell = $('#cell_' + this.just_clicked.getOuter() + '_' + this.just_clicked.getInner());
		cell.text(value).removeClass('cell-selected').removeClass('inner-clickable');
		$('#candidates').children().remove();
	},

	initialiseGrid: function(puzzle) {
		console.log(">> initialiseGrid");
		for (i = 1; i <= Math.pow(this.dimension, 2); i++) {
			this.grid_state[i - 1] = [];
			for (j = 1; j <= Math.pow(this.dimension, 2); j++) {
				this.grid_state[i - 1][j - 1] = null;
			}
		}
		this.viewModel.cellAssignments.removeAll();
		if (puzzle) {
			console.log('>> Loading puzzle ' + JSON.stringify(puzzle));
			for (i = 0; i < puzzle.length; i++) {
				this.grid_state[puzzle[i][0] - 1][puzzle[i][1] - 1] = puzzle[i][2];
				//this.viewModel.cellAssignments.push( "a" );
				this.viewModel.cellAssignments.push( { "outer" : puzzle[i][0], "inner" : puzzle[i][1], "cellValue" : puzzle[i][2] } );
				var cell = $('#cell_' + puzzle[i][0] + "_" + puzzle[i][1]);
				cell.text(puzzle[i][2]);
			}
        }
		console.log(">> number of cell assignments: " + this.viewModel.cellAssignments().length );
	},

	cellClick: function(e) {
		console.log(JSON.stringify(sudoku.just_clicked));
		if (this.just_clicked != null) {
			console.log("May need to toggle the style");
		} else {
			console.log('wibble');
		}
		$(this).addClass('cell-selected');
		$('#cells').children().remove();
		theCell = new Cell($(this).data('outer'), $(this).data('inner'));
		sudoku.just_clicked = theCell;
		candidates = theCell.getCandidates();
		console.log(JSON.stringify(candidates));
	},

	getGridState: function(cell) {
		var oCoord = cell.getOuter() - 1;
		var iCoord = cell.getInner() - 1;
		if (this.grid_state[oCoord] != null && this.grid_state[oCoord][iCoord] != null) {
			return this.grid_state[oCoord][iCoord];
		} else {
			return null;
		}
	},


	buildGrid: function(node) {
		console.log(">> buildGrid");
		for (var i = 1; i <= (this.dimension * this.dimension); i++) {
			var outer = $('<div></div>');
			outer.addClass("outerCell");
			for (var j = 1; j <= (this.dimension * this.dimension); j++) {
				var inner = $('<div></div>');
				inner.attr('id', "cell_" + i + "_" + j);
				inner.addClass("innerCell");
				outer.append(inner);
				if (j % this.dimension == 0) {
					clearDiv = $('<div></div>');
					clearDiv.addClass("clear-inner");
					outer.append(clearDiv);
				}
				inner.data("outer", i);
				inner.data("inner", j);
				if (this.grid_state[i - 1][j - 1] == null) {
					inner.text(' ');
					inner.addClass('inner-clickable');
				} else {
					inner.text(this.grid_state[i - 1][j - 1]);
					inner.addClass('inner-unclickable');
				}
			}
			node.append(outer);
			if (i % this.dimension == 0) {
				var clearDiv = $('<div></div>');
				clearDiv.addClass("clear-outer");
				node.append(clearDiv);
			}
		}
	},


	getTheoryDesignator: function() {
		var returned = "";
		for (var i = 0; i < this.theory_stack.length; i++) {
			returned += this.theory_stack[i].cell.getOuter() + "_" + this.theory_stack[i].cell.getInner() + "_" + this.theory_stack[i].value + (i < this.theory_stack.length - 1 ? " / " : "");
		}
		return returned;
	},
	
	undoLastAssignment: function( ) {
		console.log('Undo cell assignment ');
		var cellAssignment = this.viewModel.cellAssignments.pop();
		var cell = $('#cell_' + cellAssignment.outer + '_' + cellAssignment.inner);		
		this.grid_state[cellAssignment.outer - 1][cellAssignment.inner - 1] = null
		cell.text('').addClass('inner-clickable');
	},

	speculateCellValue: function(c, v) {
		// we only push a theory if we are guessing the value
		console.log( "Status (guess | sure): " + this.viewModel.getGuessStatus() );
		var pushAssignmentFlag = ( this.grid_state[c.getOuter() - 1][c.getInner() - 1] === null );
		console.log(! this.viewModel.solving_mode());
		if ( ! this.viewModel.solving_mode() ) {
			// simply fill in the cell details, make it unclickable and return
			// it's not a theory
			this.grid_state[c.getOuter() - 1][c.getInner() - 1] = v;
			var cell = $('#cell_' + c.getOuter() + '_' + c.getInner());
			cell.text(v).removeClass('cell-selected').removeClass('inner-clickable');
		} else if ( this.viewModel.getGuessStatus() == 'sure' ) {
			// add into current theory
			console.log( "Adding cell assignment to current theory " + this.getTheoryDesignator());
			this.grid_state[c.getOuter() - 1][c.getInner() - 1] = v;
			var cell = $('#cell_' + c.getOuter() + '_' + c.getInner());
			cell.text(v).removeClass('cell-selected').removeClass('inner-clickable');//.addClass('cell-speculative');
			if ( this.theory_stack.length > 0 ) {
				cell.addClass('cell-speculative');
			}
			cell.data('theory', this.getTheoryDesignator());
		} else {
			console.log( "Pushing theory" );
			var theory = new Theory(c, v);
			this.viewModel.theory_stack.push( theory );
			this.theory_stack.push(theory);
			this.grid_state[c.getOuter() - 1][c.getInner() - 1] = v;
			var cell = $('#cell_' + c.getOuter() + '_' + c.getInner());
			cell.text(v).removeClass('cell-selected').removeClass('inner-clickable').addClass('cell-speculative');
			cell.data('theory', this.getTheoryDesignator());
			$('#candidates').children().remove();
			var liNode = $('<li></li>');
			liNode.text(c.toString() + " = " + v);
			liNode.css('margin-left', ((this.theory_stack.length - 1) * 0) + "px");
			$('#theory-panel #theory li:last a.undo').remove();
			var ulNode = $('#theory-panel #theory');
			ulNode.append(liNode);
			mk_undo_anchor();
		}
		if ( pushAssignmentFlag ) {
			// this prevents repeated counting of assignments to the same cell
			//sudoku.viewModel.cellAssignments.push( "a" );
			sudoku.viewModel.cellAssignments.push( { "outer" : c.getOuter(), "inner" : c.getInner(), "cellValue" : v } );
		}		
		// try to resolve what you can (unless we are simply defining the puzzle)
		if ( this.viewModel.solving_mode() ) {
			simpleSolve();
		}
	},
	
	setCellInTheory: function( cell, value ) {
		// set the cell value in the MODEL and also in the view
		this.grid_state[cell.getOuter() - 1][cell.getInner() - 1] = value;
		var cell_in_view = $('#cell_' + cell.getOuter()  + "_" + cell.getInner());
		cell_in_view.text( value );
		if ( this.theory_stack.length > 0 ) {
			cell_in_view.addClass('cell-speculative');
		}
		cell_in_view.data('theory', sudoku.getTheoryDesignator());
		// decorate the view element with data denoting the theory
		sudoku.viewModel.cellAssignments.push( "a" );
	},
	
	unsetCell: function( jqCell ) {
		var cpts = jqCell.attr('id').split('_');
		console.log('Unsetting cell ' + jqCell.attr('id'));
		this.grid_state[cpts[1]-1][cpts[2]-1] = null;
		// unset data
		jqCell.data( 'theory', null );
		jqCell.text(' ');
		// remove speculative class
		jqCell.removeClass('cell-speculative');
	},
	
	// undo the top element of the theory stack
	undoTheory: function() {
		console.log(">> this: " + JSON.stringify(this));
		var self = this;
		// locate all elements in latest theory
		var theory_name = this.getTheoryDesignator();
		var grid_elements = $("#grid .innerCell").filter( function(index, elt) { return $(elt).data('theory') === theory_name; } );
		console.log( 'Need to unwrap ' + grid_elements.length + ' elements' );
		$.each( grid_elements, function( i, v ) {			
			self.unsetCell( $(v) );
			self.viewModel.cellAssignments.pop();			
		} );
		// pop stack
		this.theory_stack.pop();
		this.viewModel.pop_theory();
		$( '#diagnostics .error' ).remove();
	},
	
	getModelAsTextString: function() {
		var retVal = "";
		var twodarr = [];		
		$.each( this.grid_state, function(i1,v1) {			
			$.each( v1, function(i2, v2) {
					if ( v2 != null ) {
						var tmpArr = [];
						tmpArr.push(i1+1);
						tmpArr.push(i2+1);
						tmpArr.push(v2);
						twodarr.push(tmpArr);
					}
				} )
			});
		return JSON.stringify(twodarr);
	}

};
