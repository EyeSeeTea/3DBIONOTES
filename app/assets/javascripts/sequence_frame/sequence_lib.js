function build_sequence_viewer( uniprotSeq, pdbSeq, imported_seq ){
  $j(document).ready(function(){
    _build_sequence_viewer( uniprotSeq, pdbSeq, imported_seq );
    window.addEventListener( "resize", function( event ){
      $j("#seq_div").empty();
      _build_sequence_viewer( uniprotSeq, pdbSeq, imported_seq );
    });
  });

}

function _build_sequence_viewer( uniprotSeq, pdbSeq, imported_seq ){
    var columns_format = { size: 70, spacedEach: 5 };
    var body_width = $j(body).width();
    if(body_width<900) columns_format.size = 60;
    if(body_width<750) columns_format.size = 50;

    if(imported_seq){
      sequence_panel = new Biojs.Sequence_multiple_alignment({
        sequence : uniprotSeq,
        seq_alig : pdbSeq,
        seq_impo : imported_seq,
        columns: columns_format,
        target : "seq_div"
      });
    }else{
      sequence_panel = new Biojs.Sequence_alignment({
        sequence : uniprotSeq,
        seq_alig : pdbSeq,
        columns: columns_format,
        target : "seq_div"
      });
    }

    /*sequence_panel.onSelectionChange(function(elem){
    });*/

    sequence_panel.onSelectionChanged(function(elem){
      var begin = elem.start+1;
      var end = elem.end+1;
      var color = "rgb(255, 233, 153)";
      var selection = {begin:begin, end:end, color:color, frame:"downRightBottomFrame"};
      trigger_aa_selection( selection );
      //sequence_panel.setSelection(begin-1,end-1);
      var divSelected = "#0_"+(begin-1);
      if($j(divSelected).length > 0){
        $j(".body_div").scrollTop( $j(divSelected).offset().top - $j(divSelected).parent().offset().top );
      }
    });

    check_global_selection();
}

function multipleHighlight(features){
  sequence_panel.removeAllHighlights()
  features.forEach(function(f){
    sequence_panel.addHighlight({ "start": f.start-1, "end": f.end-1, "color": "black", "background": "#FFE999", "id": "aaa" })
  });
}


