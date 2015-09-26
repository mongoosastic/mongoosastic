#!/bin/sh
git log --reverse --format='%aN <%aE>' | perl -we '
BEGIN {
%seen = (), @authors = ();
}
while (<>) {
next if $seen{$_};
$seen{$_} = push @authors, $_;
}
END {
print @authors;
}
' | sort | uniq > AUTHORS
