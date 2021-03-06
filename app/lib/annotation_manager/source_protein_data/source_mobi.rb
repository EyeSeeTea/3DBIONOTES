module AnnotationManager
  module SourceProteinData
    module SourceMobi 

      MobiURL = Settings.GS_MobiURL # http://mobidb.bio.unipd.it/ws

      def sourceMobiFromUniprot(uniprotAc)
        method = {'full'=>'curated databases', 'missing_residues'=>'missing electron densities', 'bfactor'=>'high temperature residues', 'mobile'=>'backbone displacemen in NMR structures', 'mobi2'=>'Inferred from PDB structures' }
        source = {'db'=>'database','derived'=>'inferred'}
        out = Mobientry.find_by(proteinId: uniprotAc)
        if out.nil?
          url = MobiURL+"/"+uniprotAc+"/consensus"
          data = {}
          begin
            # http = Net::HTTP.new(url)
            # http.open_timeout = 5
            # data = http.get_response(URI.parse(url)).body
            data = Net::HTTP.get_response(URI.parse(url)).body
            data = JSON.parse(data)
          rescue
            puts "Error downloading data\nURL: #{url}\nERROR: #{$!}"
            data = {}
            #raise "Error downloading data:\n#{$!}"
          end   
          
          main_out = {}
          out = {}
          flag =  false
          if data.key?("mobidb_consensus") and data['mobidb_consensus'].key?("disorder") 
            for j in ['db','derived','predictors']
            # for j in ['db','derived']
              if data['mobidb_consensus']['disorder'].key?(j)
                out[source[j]] = []
                data['mobidb_consensus']['disorder'][j].each do |i|
                  if i['method'] != "full" or j == "db" then
                    i['regions'].each do |k|
                      if k[2] =~ /D/ then
                        flag = true
                        out[source[j]].push( {'start'=>k[0],'end'=>k[1], 'method'=>method[i['method']]} )
                      end
                    end
                  end
                end
              end
            end
          end
          main_out['disorder'] = out
          out = {}
          if data.key?("mobidb_consensus") and data['mobidb_consensus'].key?("lips") 
            for j in ['db','derived']
              if data['mobidb_consensus']['lips'].key?(j) then
                out[source[j]] = []
                data['mobidb_consensus']['lips'][j].each do |i|
                  i['regions'].each do |k|
                    if k[2] =~ /D/ then
                      flag = true
                      out[source[j]].push( {'start'=>k[0],'end'=>k[1], 'method'=>method[i['method']]} )
                    end
                  end
                end
              end
            end
          end
          main_out['lips'] = out
          if flag
            Mobientry.create(proteinId: uniprotAc, data:main_out.to_json)
          end
        else
          main_out = JSON.parse(out.data)
        end
        return main_out 
      end

    end 
  end
end
