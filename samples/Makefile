LIBS=
RUN=../run
RUNFLAGS=

.PHONY: default all clean

AST = $(patsubst %.lithp, %.ast, $(wildcard *.lithp))

default: $(AST) final
all: default

FINAL=

%.ast: %.lithp
	$(eval FINAL += $<)

final:
	@if [ "$(FINAL)"x != "x" ]; then $(RUN) $(RUNFLAGS) -c $(FINAL); fi

clean:
	-rm -f *.ast

