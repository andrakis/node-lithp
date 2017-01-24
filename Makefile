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
	@if [ "$(FINAL)"x != "x" ]; then $(RUN) -c $(FINAL); fi

$(SUBDIRS):
	$(MAKE) -C $@

clean:
	-rm -f *.ast
	$(MAKE) -C modules clean
	$(MAKE) -C samples clean

