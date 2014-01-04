DOC_FILES = erlb.js erlb-test.js erlb-test.html
all:

docs:
	@if git branch | grep -q gh-pages; \
        then git checkout    gh-pages; \
        else git checkout -b gh-pages; \
    fi
	rm -fr bin e*.{js,html}* Makefile LICENSE README.md
	git checkout master $(DOC_FILES)
	git add $(DOC_FILES)
	git commit -a --amend -m 'Documentation updated'
	@sh -c "ret=0; set +e; \
			if git push origin +gh-pages; \
			then echo 'Pushed gh-pages to origin'; \
			else ret=1; \
			fi; \
			set -e; git checkout master; \
			exit $$ret"
