LIBS=
RUN=./run
RUNFLAGS=

.PHONY: modules samples clean

AST = $(patsubst %.lithp, %.ast, $(wildcard *.lithp))

SUBDIRS = modules samples
default: $(AST) final $(SUBDIRS)
all: default

FINAL=

%.ast: %.lithp
	$(eval FINAL += $<)

final:
	@if [ "$(FINAL)"x != "x" ]; then $(RUN) $(RUNFLAGS) -c $(FINAL); fi

$(SUBDIRS):
	echo "Running make with flags: $(RUNFLAGS)"
	$(MAKE) -C $@ RUNFLAGS=$(RUNFLAGS)

clean:
	-rm -f *.ast
	$(MAKE) -C modules clean
	$(MAKE) -C samples clean

