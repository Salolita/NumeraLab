function [value, terms] = numralab_interpolate(x, y, t)
% Newton divided differences evaluated at one point.
validateattributes(x, {'numeric'}, {'vector','real','finite'});
validateattributes(y, {'numeric'}, {'vector','real','finite','numel',numel(x)});
validateattributes(t, {'numeric'}, {'scalar','real','finite'});
n = numel(x);
assert(n >= 2 && n <= 30 && numel(unique(x)) == n, 'Expected 2–30 distinct x values.');
c = double(y(:).');
x = double(x(:).');
for k = 2:n
    for j = n:-1:k
        c(j) = (c(j)-c(j-1))/(x(j)-x(j-k+1));
    end
end
terms = zeros(1,n);
terms(1) = c(1);
for k = 2:n
    terms(k) = c(k)*prod(t-x(1:k-1));
end
value = sum(terms);
assert(isfinite(value) && all(isfinite(terms)), 'Interpolation overflow.');
end
