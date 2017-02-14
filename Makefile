LIBS=
RUN=./run
RUNFLAGS=

.PHONY: modules samples clean

AST = $(patsubst %.lithp, %.ast, $(wildcard *.lithp))

SUBDIRS = modules samples
default: links
all: default

FINAL=

none:

links:
	if [ ! -L "run" ]; then \
		ln -s node_modules/lithp/run.js run; \
	fi

%.ast: %.lithp
	$(eval FINAL += $<)

ast: links $(SUBDIRS)
	$(MAKE) -C modules RUNFLAGS="$(RUNFLAGS)"
	@if [ "$(FINAL)"x != "x" ]; then $(RUN) $(RUNFLAGS) -c $(FINAL); fi

$(SUBDIRS):
	echo "Running make with flags: $(RUNFLAGS)"
	$(MAKE) -C $@ RUNFLAGS="$(RUNFLAGS)"

clean:
	-rm -f *.ast
	$(MAKE) -C modules clean
	$(MAKE) -C samples clean

