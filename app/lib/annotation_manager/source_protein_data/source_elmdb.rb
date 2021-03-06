module AnnotationManager
  module SourceProteinData
    module SourceElmdb 

      ElmScript = Settings.GS_ElmScript

      def sourceElmdbFromUniprot(uniprotAc)
        out = Elmdbentry.find_by(proteinId: uniprotAc)
        if out.nil?
          cmd = ElmScript+" "+uniprotAc
          out = `#{cmd}`
          out.gsub! /\\r/,"" 
          if out.length > 0
            Elmdbentry.create(proteinId: uniprotAc, data: out)
          end
        else
          out = out.data
        end
        begin
          out = JSON.parse(out)
        rescue
          out = JSON.parse({})
        end
        return out
      end
    end 
  end
end
